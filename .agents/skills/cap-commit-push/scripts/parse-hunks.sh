#!/usr/bin/env bash
# parse-hunks.sh — Parse git diff into individual hunks for selective staging
#
# Usage:
#   parse-hunks.sh <file>                   # List hunks
#   parse-hunks.sh <file> --apply 1,3       # Output hunks 1 and 3 as patch
#   parse-hunks.sh <file> --cached          # Use staged diff (--cached)
#   parse-hunks.sh <file> --apply 1,3 --cached  # Combined

set -euo pipefail

# ── Args ────────────────────────────────────────────────────────────────────

FILE=""
APPLY=""
CACHED=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --apply)
            APPLY="$2"
            shift 2
            ;;
        --cached)
            CACHED="--cached"
            shift
            ;;
        -*)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
        *)
            FILE="$1"
            shift
            ;;
    esac
done

if [[ -z "$FILE" ]]; then
    echo "Usage: parse-hunks.sh <file> [--apply 1,3] [--cached]" >&2
    echo "  Note: When piping --apply output to git apply, use --unidiff-zero flag" >&2
    exit 1
fi

# Allow deleted files (exist in index but not on disk) and untracked new files
# Don't check file existence here; git diff will handle it

# ── Get diff ────────────────────────────────────────────────────────────────

# Use -U0 (zero context lines) for precise hunk separation.
# Without this, git merges nearby changes into one hunk.
DIFF=$(git diff -U0 $CACHED -- "$FILE" 2>/dev/null || true)

# If no diff found, try some fallbacks
if [[ -z "$DIFF" ]]; then
    # Check if file is untracked (new file)
    TRACKED=$(git ls-files --error-unmatch "$FILE" 2>/dev/null || true)
    if [[ -z "$TRACKED" ]] && [[ -e "$FILE" ]]; then
        echo "New untracked file: $FILE (use 'git add' to stage the entire file)"
        exit 0
    fi
    # Check if changes are already staged (e.g. git rm)
    STAGED_DIFF=$(git diff -U0 --cached -- "$FILE" 2>/dev/null || true)
    if [[ -n "$STAGED_DIFF" ]]; then
        echo "Changes for '$FILE' are already staged. Use 'git diff --cached' to view."
        exit 0
    fi
    echo "No diff found for '$FILE'."
    exit 0
fi

# ── Check for special file states ───────────────────────────────────────────

# New file
if echo "$DIFF" | grep -q "^new file mode"; then
    if [[ -n "$APPLY" ]]; then
        echo "$DIFF"
    else
        echo "New file: $FILE (entire file is one hunk)"
    fi
    exit 0
fi

# Deleted file
if echo "$DIFF" | grep -q "^deleted file mode"; then
    if [[ -n "$APPLY" ]]; then
        echo "$DIFF"
    else
        echo "Deleted file: $FILE (entire file is one hunk)"
    fi
    exit 0
fi

# Renamed file
if echo "$DIFF" | grep -q "^rename from"; then
    if [[ -n "$APPLY" ]]; then
        echo "$DIFF"
    else
        echo "Renamed file: $FILE"
    fi
    exit 0
fi

# ── Parse hunks ─────────────────────────────────────────────────────────────

# Extract the diff header (everything before the first @@)
HEADER=$(echo "$DIFF" | sed '/^@@/,$d')

# Extract hunk bodies (from first @@ onwards)
HUNKS_BODY=$(echo "$DIFF" | sed -n '/^@@/,$p')

if [[ -z "$HUNKS_BODY" ]]; then
    echo "No hunks found in diff for '$FILE'."
    exit 0
fi

# Split into individual hunks and collect metadata
declare -a HUNK_STARTS=()
declare -a HUNK_LINES=()
declare -a HUNK_OLD_START=()
declare -a HUNK_OLD_COUNT=()
declare -a HUNK_NEW_START=()
declare -a HUNK_NEW_COUNT=()
declare -a HUNK_ADDS=()
declare -a HUNK_DELS=()
declare -a HUNK_CONTEXTS=()

HUNK_NUM=0
LINE_NUM=0
CURRENT_HUNK_START=-1
CURRENT_OLD_START=0
CURRENT_OLD_COUNT=0
CURRENT_NEW_START=0
CURRENT_NEW_COUNT=0
CURRENT_ADDS=0
CURRENT_DELS=0
CURRENT_CONTEXT=""

while IFS= read -r line; do
    LINE_NUM=$((LINE_NUM + 1))

    if [[ "$line" =~ ^@@\ -([0-9]+)(,([0-9]+))?\ \+([0-9]+)(,([0-9]+))?\ @@(.*) ]]; then
        # Save previous hunk if exists
        if [[ $CURRENT_HUNK_START -ge 0 ]]; then
            HUNK_OLD_START+=($CURRENT_OLD_START)
            HUNK_OLD_COUNT+=($CURRENT_OLD_COUNT)
            HUNK_NEW_START+=($CURRENT_NEW_START)
            HUNK_NEW_COUNT+=($CURRENT_NEW_COUNT)
            HUNK_ADDS+=($CURRENT_ADDS)
            HUNK_DELS+=($CURRENT_DELS)
            HUNK_CONTEXTS+=("$CURRENT_CONTEXT")
        fi

        # Start new hunk
        HUNK_NUM=$((HUNK_NUM + 1))
        CURRENT_HUNK_START=$LINE_NUM
        HUNK_STARTS+=($LINE_NUM)

        CURRENT_OLD_START=${BASH_REMATCH[1]}
        CURRENT_OLD_COUNT=${BASH_REMATCH[3]:-1}
        CURRENT_NEW_START=${BASH_REMATCH[4]}
        CURRENT_NEW_COUNT=${BASH_REMATCH[6]:-1}
        CURRENT_CONTEXT="${BASH_REMATCH[7]}"
        # Trim leading whitespace from context
        CURRENT_CONTEXT="${CURRENT_CONTEXT#"${CURRENT_CONTEXT%%[![:space:]]*}"}"
        CURRENT_ADDS=0
        CURRENT_DELS=0

    elif [[ "$line" == +* ]] && [[ "$line" != +++* ]]; then
        CURRENT_ADDS=$((CURRENT_ADDS + 1))
    elif [[ "$line" == -* ]] && [[ "$line" != ---* ]]; then
        CURRENT_DELS=$((CURRENT_DELS + 1))
    fi
done <<< "$HUNKS_BODY"

# Save last hunk
if [[ $CURRENT_HUNK_START -ge 0 ]]; then
    HUNK_OLD_START+=($CURRENT_OLD_START)
    HUNK_OLD_COUNT+=($CURRENT_OLD_COUNT)
    HUNK_NEW_START+=($CURRENT_NEW_START)
    HUNK_NEW_COUNT+=($CURRENT_NEW_COUNT)
    HUNK_ADDS+=($CURRENT_ADDS)
    HUNK_DELS+=($CURRENT_DELS)
    HUNK_CONTEXTS+=("$CURRENT_CONTEXT")
fi

TOTAL_HUNKS=$HUNK_NUM

if [[ $TOTAL_HUNKS -eq 0 ]]; then
    echo "No hunks found in diff for '$FILE'."
    exit 0
fi

# ── List mode ───────────────────────────────────────────────────────────────

if [[ -z "$APPLY" ]]; then
    echo "Hunks for $FILE ($TOTAL_HUNKS total):"
    echo ""
    for i in $(seq 0 $((TOTAL_HUNKS - 1))); do
        NUM=$((i + 1))
        OLD="${HUNK_OLD_START[$i]}"
        NEW="${HUNK_NEW_START[$i]}"
        ADDS="${HUNK_ADDS[$i]}"
        DELS="${HUNK_DELS[$i]}"
        CTX="${HUNK_CONTEXTS[$i]}"
        CTX_STR=""
        if [[ -n "$CTX" ]]; then
            CTX_STR=" [$CTX]"
        fi
        printf "  Hunk #%-3d (lines ~%d-%d): +%d -%d%s\n" "$NUM" "$NEW" "$((NEW + HUNK_NEW_COUNT[$i]))" "$ADDS" "$DELS" "$CTX_STR"
    done
    exit 0
fi

# ── Apply mode ──────────────────────────────────────────────────────────────

# Parse requested hunk numbers
IFS=',' read -ra REQUESTED <<< "$APPLY"

# Validate
for num in "${REQUESTED[@]}"; do
    if ! [[ "$num" =~ ^[0-9]+$ ]] || [[ "$num" -lt 1 ]] || [[ "$num" -gt "$TOTAL_HUNKS" ]]; then
        echo "Error: Invalid hunk number '$num'. Valid range: 1-$TOTAL_HUNKS" >&2
        exit 1
    fi
done

# Extract selected hunks from the full diff
SELECTED_PATCH=""
IN_HUNK=0
HUNK_IDX=0
HUNK_LINE_IN_BODY=0

# We need to re-parse the hunks body and select specific ones
HUNK_IDX=0
CAPTURE=0
HUNK_LINES_BUF=""

while IFS= read -r line; do
    if [[ "$line" =~ ^@@\ -([0-9]+)(,([0-9]+))?\ \+([0-9]+)(,([0-9]+))?\ @@ ]]; then
        # If we were capturing, save the buffer
        if [[ $CAPTURE -eq 1 ]]; then
            SELECTED_PATCH="${SELECTED_PATCH}${HUNK_LINES_BUF}
"
        fi

        HUNK_IDX=$((HUNK_IDX + 1))
        HUNK_LINES_BUF="$line"
        CAPTURE=0

        # Check if this hunk is requested
        for num in "${REQUESTED[@]}"; do
            if [[ "$num" -eq "$HUNK_IDX" ]]; then
                CAPTURE=1
                break
            fi
        done
    elif [[ $CAPTURE -eq 1 ]]; then
        HUNK_LINES_BUF="${HUNK_LINES_BUF}
${line}"
    fi
done <<< "$HUNKS_BODY"

# Capture last hunk if still buffering
if [[ $CAPTURE -eq 1 ]]; then
    SELECTED_PATCH="${SELECTED_PATCH}${HUNK_LINES_BUF}
"
fi

# Output the patch with header
if [[ -n "$SELECTED_PATCH" ]]; then
    echo "$HEADER"
    echo "$SELECTED_PATCH"
else
    echo "Error: No hunks selected." >&2
    exit 1
fi

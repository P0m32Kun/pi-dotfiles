# Pi Coding Agent Setup

## Configuration Complete

Your pi agent is now configured with:

### Core Settings
- **Thinking mode**: Medium (balanced reasoning)
- **Theme**: Dark
- **Delivery**: One-at-a-time for steering and follow-ups
- **Compaction**: Enabled on overflow and proactive (90% threshold)
- **Tools**: read, write, edit, bash (minimal defaults)
- **Telemetry**: Disabled

### Installed Packages
- `@sherif-fanous/pi-rtk` - RTK (Rust Token Killer) integration for token savings

### Provider
- **Default**: rex-codex with gpt-5.4

## Adding Capabilities

Pi supports three extension mechanisms:

### 1. Agent Skills
On-demand capability packages invoked via `/skill:name`

Example:
```
/skill:debug
/skill:frontend-design
```

### 2. Pi Extensions
TypeScript modules for custom tools, commands, and UI components.

Install:
```bash
pi install npm:package-name
pi install git:https://github.com/user/repo
```

Create your own:
```bash
mkdir -p ~/.pi/extensions/my-extension
cd ~/.pi/extensions/my-extension
npm init pi-extension
```

### 3. Pi Packages
Bundled extensions/skills/prompts/themes shareable via npm or git.

Install:
```bash
pi install npm:@username/package-name
pi install git:https://github.com/user/pi-package
```

## Token Optimization

RTK is automatically integrated via `@sherif-fanous/pi-rtk`. Check savings:
```bash
rtk gain
```

## Workflow

1. **Research** → Use skills like `/search-first`
2. **Plan** → Create implementation plan
3. **Implement** → Write code with TDD approach
4. **Test** → Verify 80%+ coverage
5. **Review** → Use `/review` skill

## Documentation

Full pi documentation: https://github.com/badlogic/pi-mono

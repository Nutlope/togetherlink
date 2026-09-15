# TogetherLink

![TogetherLink — frontier open models in your favorite agent](assets/togetherlink-cover.png)

Frontier open models in your favorite agent.

TogetherLink connects Claude Code and Claude Desktop to fast open models on
[Together AI](https://togetherai.link/?utm_source=togetherlink&utm_medium=referral&utm_campaign=example-app).
Keep your existing Claude login, settings, memory, and history. TogetherLink adds
the model route for the session and shows the cost when you finish.

## Install

```bash
curl -fsSL https://install.togetherlink.dev | bash
```

Then launch TogetherLink:

```bash
tlink
```

Use Claude Code directly:

```bash
tclaude
```

Or configure Claude Desktop, Cowork, and Code on macOS:

```bash
tclaude-desktop
```

The Desktop integration is reversible. Switch back to official Claude without
removing TogetherLink:

```bash
tclaude-desktop off
```

TogetherLink updates itself automatically. Existing installations from the old
`togetherlink.vercel.app` channel migrate to the current release automatically.

## Models

Auto Router is the default. TogetherLink currently includes Kimi K3, GLM 5.3,
GLM 5.3 Flash, and DeepSeek V4.1 Flash. You can also select a model for one
Claude Code launch:

```bash
togetherlink --model zai-org/GLM-5.3 claude
```

See the live product, model details, pricing, and demos at
[togetherlink.dev](https://togetherlink.dev/).

## Help and feedback

This repository is TogetherLink's public support tracker. If the CLI does not
install, update, or launch correctly, [open an issue](https://github.com/Nutlope/togetherlink/issues/new)
with your operating system, the command you ran, and the complete error message.

Please do not include API keys or other credentials in an issue.

## Authors

- [Riccardo Giorato](https://github.com/riccardogiorato)
- [Hassan El Mghari](https://github.com/Nutlope)

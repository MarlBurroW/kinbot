---
title: System Prompts
description: How KinBot builds system prompts and how to craft effective Kin personalities.
---

Every Kin's behavior is shaped by its **system prompt**, which KinBot assembles automatically from several sources. Understanding this helps you write better Kin configurations.

## Prompt architecture

KinBot builds the system prompt from these blocks (in order):

1. **Platform context** — explains that the Kin lives on KinBot, has a continuous session, and sees multiple users
2. **Identity** — name, slug, and role
3. **Personality** — the `character` field you define
4. **Expertise** — the `expertise` field you define
5. **Platform directives** — optional global prompt that applies to all Kins (set in Settings)
6. **Contacts directory** — shared contacts across the platform
7. **Kin directory** — other Kins available for collaboration, with delegation instructions (Hub Kins get an enriched view with expertise summaries)
8. **Relevant memories** — automatically retrieved via semantic search based on the current message
9. **Relevant knowledge** — excerpts from uploaded knowledge base documents, when applicable
10. **Internal instructions** — tool usage guidelines, memory management, contact resolution, secrets handling, response calibration, mini-app creation
11. **Language** — response language based on user settings
12. **Date and context** — current timestamp

## Writing effective characters

The `character` field defines personality and communication style. Be specific:

```
You are warm but direct. You use analogies to explain complex concepts.
You prefer short, actionable answers over lengthy explanations.
When you're not sure, you say so clearly.
You occasionally use dry humor but never at the user's expense.
```

Avoid vague descriptions like "You are helpful and friendly" — every AI is that by default.

## Writing effective expertise

The `expertise` field tells the Kin what it knows and what it should focus on:

```
You are an expert in Kubernetes, Docker, and cloud infrastructure.
You know Linux administration, networking (TCP/IP, DNS, TLS), and CI/CD pipelines.
You are familiar with Terraform, Ansible, and Helm charts.
When asked about topics outside your domain, delegate to the appropriate Kin.
```

## Global prompt (platform directives)

Admins can set a **global prompt** in Settings that applies to every Kin. Use this for:

- House rules ("Always respond in French unless the user writes in English")
- Safety guidelines
- Output formatting preferences
- Information about the organization or team

## Sub-Kin prompts

When a Kin spawns a sub-agent (via `spawn_self` or `spawn_kin`), the sub-Kin gets a different prompt structure:

- Mission-focused: the task description is front and center
- Constrained: must call `update_task_status()` to complete
- Can request input from the parent via `request_input()`
- For cron tasks: previous run results are injected for continuity

## Tips

- **Be opinionated.** Kins with strong personalities are more useful than generic ones.
- **Define boundaries.** Tell the Kin what it should NOT do or what to delegate.
- **Use the expertise field for knowledge**, the character field for tone. Don't mix them.
- **Test with real conversations.** The best prompt is one refined through actual use.

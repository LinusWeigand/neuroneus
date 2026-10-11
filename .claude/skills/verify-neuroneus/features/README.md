# Feature map

What a user does in Neuroneus, and the observable result that proves each feature works. One file per feature.

| Feature | Drive | Proves |
|---|---|---|
| [Home](home.md) | `home` | The landing page renders. |
| [Language switch](language.md) | `language` | English and German switch both ways, server and client parts alike. |
| [Create a project](create-project.md) | `create-project` | A project is created and the kickoff huddle ends with a decision card. |
| [Huddle](huddle.md) | `huddle --project <id>` | A message gets agent replies and, if anything is open, a card. |
| [Decision card](decide.md) | `decide --project <id>` | Answering a card locks the decision and the team confirms. |
| [Project tab](project-tab.md) | `project-tab --project <id>` | Spec, builder, model choice and usage render. |
| [Delete a project](delete-project.md) | `delete-project --project <id>` | The project and everything it owns is gone. |
| Build round | `wait-build --project <id>` (profile full) | A round plans, builds, verifies and ships. |

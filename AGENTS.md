# Maintenance rules

- Keep one authoritative implementation for each behavior. Reuse the existing practice and race engines.
- Prefer removing duplication and obsolete code before adding layers, flags, dependencies or files. A new module must own a cohesive responsibility.
- Keep routing, persistence and presentation separate. Centralize repeated save acknowledgements so revisions and state serialization cannot drift.
- Preserve authentication, revision guards, request ownership and saved-record compatibility during refactors. Keep legacy adaptation at input boundaries and document why it remains.
- Separate structural refactoring from features, scoring changes and schema changes. Avoid incidental UI redesigns or release-number churn.
- Verify refactors with existing behavioral regressions. Add tests for observable failures or contracts, not copies of implementation details. Keep architecture notes current.

Repository-facing documentation is English and Japanese. Store project outputs on F:.

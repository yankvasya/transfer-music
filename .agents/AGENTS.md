# Agent Rules for transfer-music

- **Language**: Respond EXCLUSIVELY in English to all user prompts.
- **Token Efficiency**:
  - Do NOT rewrite entire files. Use precise targeted edits (`replace_file_content` / `multi_replace_file_content`) with narrow line ranges.
  - Keep code explanations, comments, and replies extremely concise. Do not output redundant blocks of code in your explanations.
  - Read existing files before writing. Don't re-read unless changed.
  - Skip files over 100KB unless required.
  - No sycophantic openers or closing fluff. No emojis or em-dashes.
  - Do not guess APIs.

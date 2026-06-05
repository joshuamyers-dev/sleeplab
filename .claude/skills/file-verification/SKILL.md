---
name: file-verification
description: Ensure files exist before mapping or proceeding.
compatibility: opencode
metadata:
  workflow: file-ops
---

## File Verification Rule

Never assume a file was created successfully. You must execute a shell command to explicitly verify the file exists on the disk before mapping it or proceeding to the next step.

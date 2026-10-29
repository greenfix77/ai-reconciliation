#!/bin/bash
# Fully-detached dev-server starter: double-forks so the final process is
# reparented to PID 1 (tini) and is not in the caller's process tree at all.
cd /home/z/my-project || exit 1
(
  setsid bash -c 'exec bun run dev </dev/null >>/home/z/my-project/dev.log 2>&1' &
) </dev/null >/dev/null 2>&1
disown -a
exit 0

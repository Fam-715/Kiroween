# Team Workflow Guide

How our team of 3 works on the same GitHub repo without overwriting each other's work.

**The idea in one line:** everyone works on their own *branch* (a private copy of the
project), then asks to merge it into `main` with a *Pull Request (PR)*. The repo owner reviews
and merges.

```
main ──●────────────●──────────●───▶   (the real project)
        \          /          /
         ●──●──●──●          /          teammate-a/mcp-setup
          \                 /
           ●──●──●──●──●───●            teammate-b/design-system
```

---

## Part 0: One-time setup

### Repo owner: invite teammates (do this once)
1. Go to https://github.com/Fam-715/Kiroween
2. Click **Settings** (top bar of the repo) → **Collaborators** (left menu).
3. Click **Add people**, type each teammate's GitHub username, click **Add**.
4. Each teammate accepts the invite from their email or https://github.com/notifications.

### Each teammate: get the project on your laptop
1. Install **GitHub Desktop** (https://desktop.github.com) and sign in with your GitHub account.
2. **File → Clone repository** → choose the **Kiroween** repo → pick a folder that is **not**
   inside OneDrive (for example `C:\dev\`) → **Clone**.
3. Open **Kiro** → **File → Open Folder** → select the cloned `Kiroween` folder.
4. Click **Trust** if Kiro shows "Restricted Mode".

---

## Part 1: Every time you start a new task (teammates)

### Step 1: Get the latest version of `main`
1. In GitHub Desktop, click **Current branch** (top middle) and select **main**.
2. Click **Fetch origin**, then **Pull origin** if it appears.

> Always start from an up-to-date `main`. Most merge problems come from skipping this.

### Step 2: Create your own branch
1. Click **Current branch** → **New branch**.
2. Name it `<your-name>/<what-you-are-doing>`, for example:
   - `alex/mcp-setup`
   - `sam/design-system`
3. Make sure it says **Create branch based on main**, then click **Create branch**.

### Step 3: Do the work in Kiro
1. In Kiro, check the bottom-left corner shows your new branch name.
2. Do the task (see the task list your team lead gave you).
3. **Only add new files.** Do not edit these unless the team lead says so:
   - `.kiro/specs/**`
   - `.kiro/steering/product.md`, `tech.md`, `structure.md`
   - `README.md`
   - `docs/kiro-playbook.md`
4. Write your Kiro log in **your own file**: `docs/kiro-log/<your-name>.md`
   (one file per person, so nobody gets merge conflicts). Use this format:

   ```markdown
   | Date | Kiro feature | What I asked | What happened / what I learned |
   |---|---|---|---|
   | 2026-11-24 | MCP | Added the fetch MCP server and asked Kiro to read MDN docs | It summarised browser support; Firefox has no Web Speech API |
   ```

### Step 4: Commit (save a checkpoint)
1. Go to GitHub Desktop. Your changed files appear on the left.
2. Check only the files you meant to change are ticked.
3. Bottom-left **Summary** box: write what you did, e.g. `Add fetch MCP server and browser API notes`.
4. Click **Commit to `<your-branch>`**.

> Commit small and often, e.g. after each finished piece. It's your undo history.

### Step 5: Push your branch to GitHub
- First time on this branch: click **Publish branch** (top right).
- After that: click **Push origin**.

### Step 6: Open a Pull Request
1. In GitHub Desktop, click **Create Pull Request** (or **Branch → Create Pull Request**).
2. Your browser opens GitHub. Check it says **base: main ← compare: your-branch**.
3. Title: short description, e.g. `MCP setup and browser API research`.
4. Description: answer these 3 questions:
   - What did you add?
   - Which Kiro features did you use?
   - Anything the reviewer should check?
5. Click **Create pull request**.
6. Tell the team lead it's ready.

### Step 7: After it's merged
1. GitHub Desktop → **Current branch** → **main** → **Pull origin**.
2. Start your next task from **Step 2** with a **new** branch.

---

## Part 2: Reviewing and merging (repo owner / team lead)

1. Go to the repo on GitHub → **Pull requests** tab → open the PR.
2. Click **Files changed** and read through it. Check:
   - Only new files, or files they were allowed to change.
   - Nothing secret (no `.env`, no API keys).
   - `.kiro/` files are there and not deleted.
3. If something needs fixing: click **Review changes** → **Request changes** → write what
   to fix. The teammate fixes it on the same branch, commits and pushes again (the PR
   updates automatically).
4. If it's good: click **Merge pull request** → **Confirm merge** → **Delete branch**.
5. Tell everyone to pull `main` (Part 1, Step 1).

---

## Part 3: If something goes wrong

### "This branch has conflicts that must be resolved"
Two people changed the same lines in the same file.
1. In GitHub Desktop, switch to **your** branch.
2. **Branch → Update from main**.
3. GitHub Desktop lists the conflicting files. Click **Open in editor** (or open the file in
   Kiro). You'll see blocks like:
   ```
   <<<<<<< HEAD
   your version
   =======
   their version
   >>>>>>> main
   ```
4. Keep what's correct (often both parts), delete the `<<<<<<<`, `=======` and `>>>>>>>`
   lines, save.
5. Back in GitHub Desktop: **Continue merge** → **Push origin**.
6. Stuck? Ask the team lead before deleting anything.

### "I committed to `main` by mistake"
Don't push. In GitHub Desktop: **Branch → New branch** (it brings your commits along), then
ask the team lead to help reset `main`.

### "I made a mess and want to start over"
If you haven't committed: right-click the file in GitHub Desktop → **Discard changes**.

### Kiro changed files I didn't expect
In Kiro's chat, use **View changes** to see them, and **Revert changes** before committing
if they're wrong. Keep Kiro in **Supervised** mode while learning.

---

## Quick checklist (stick this somewhere)

- [ ] Pull `main` before starting
- [ ] New branch: `<name>/<task>`
- [ ] Only add new files (don't touch spec/steering/README/playbook)
- [ ] Log Kiro use in `docs/kiro-log/<name>.md`
- [ ] Commit small and often
- [ ] Push → Pull Request → tell the team lead
- [ ] After merge: switch to `main` and pull

# Contributing

Contributors only need to:

- Edit `README.md` to add recommendation item.
- Add the original figure file if needed.
- Commit the changes with a conventional commit message.

## Specs

- Keep the existing `year-author-journal` heading convention.
- Include a citation, paper link, and at least one tag.
- Place the original figure in the matching `figures` category when it is not hosted externally.
- If no palette is needed, omit the `Color` field.
- Commit with conventional commit messages, e.g., `docs: add 2026-Author-Journal figure`.

## Guide example

Add the entry to the appropriate category in `README.md` using the following structure:

```markdown
<h3>2026-Author-Journal</h3>
<img alt="Fig. 1" src="./figures/category/example.jpg" width="1000" loading="lazy" decoding="async">

<details markdown="1">
<summary><b>Citation & Details</b></summary>

**Citation (APA):** Author, A. (2026). Paper title. *Journal*, volume, pages.

**Link:** [[paper]](https://doi.org/example)

**Tag:** `example`

**Color:** `#112233` `#AABBCC` `#FFFFFF`

</details>

---
```

Thank you for contributing to `awesome-scientific-figure`. Good luck!

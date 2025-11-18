# Repository Guidelines

## Project Structure & Module Organization
- `src/main.zig` holds the CLI entry point; keep it thin and delegate logic to library modules imported via `@import("zault")`.
- `src/root.zig` is the library surface; export shared helpers here and colocate unit tests with the functions they cover.
- `book/src/` (mdBook) contains the protocol specification (`protocol-specification.md`) referenced by `KICKSTART.md`; update `SUMMARY.md` whenever you add chapters.
- `build.zig`/`build.zig.zon` define targets and modules; never edit `zig-out/` artifacts directly.
- Roadmapping material (`ROADMAP.md`, `KICKSTART.md`, `ZIG.md`) documents priorities and Zig 0.15.x gotchas—consult them before large refactors.

## Build, Test, and Development Commands
```sh
zig build                       # Compile library + CLI and stage into zig-out/
zig build run -- <args>         # Execute the CLI via the install step
zig build test                  # Run library and executable test suites
zig build -Doptimize=ReleaseFast  # Produce an optimized binary for benchmarking
zig build install --prefix ~/.local  # Install the CLI for local use
```
Keep releases reproducible by pinning the Zig version noted in `README.md`.

## Coding Style & Naming Conventions
- Use 4-space indentation, `lowerCamelCase` for functions, `UpperCamelCase` for types, and snake_case filenames (see `src/root.zig`).
- Follow the Zig 0.15.x rules in `ZIG.md`: avoid `usingnamespace`, pass explicit buffers to `std.fs.File.stdout().writer`, and wrap casts with `@as`.
- Prefer `const` where possible, keep public APIs `pub`-qualified at the library boundary, and document tricky call flows with brief comments only when the code is non-obvious.

## Testing Guidelines
- Add `test ""` blocks beside the code under test; `zig build test --summary fail` is the quickest feedback loop.
- Use `std.testing.fuzz` when validating parsing or serialization (see `src/main.zig` for the pattern) and ensure deterministic seeds for cryptographic cases.
- Cover new storage/crypto logic with positive, negative, and allocation-failure paths; fail the build if a test requires network or disk fixtures that are not hermetic.

## Commit & Pull Request Guidelines
- History currently favors short, imperative subject lines (`Scaffold`); continue that format (`Fix add overflow`, `Refactor block store`).
- Each pull request should include: a concise summary, a checklist of tests run (`zig build`, `zig build test`), references to roadmap items/issues, and screenshots or logs if CLI behavior changes.
- Update docs (`README.md`, `book/src/...`, `AGENTS.md`) whenever behavior, commands, or file layouts shift; stale documentation is treated as a regression.

## Security & Configuration Tips
- Never commit real key material or vault data; use obviously fake `zpub`/`zprv` strings in examples.
- When touching crypto primitives, cross-check `book/src/protocol-specification.md` and cite the relevant section in your PR to ease review.
- Run `zig env` to confirm the toolchain before introducing features that rely on master-only APIs.

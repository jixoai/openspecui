# Multi-root collaboration intent is understood; Store boundary is next

The learner correctly inferred the desired product outcome: agents operating in different package or repository scopes need independent planning context plus explicit collaboration. OpenSpec 1.6 implements cross-root References only through registered Store identities, but an existing healthy project root can be promoted and registered even when it is nested inside a monorepo and has no `.git` of its own. `store:` remains a writable-root fallback rather than a link between two roots.

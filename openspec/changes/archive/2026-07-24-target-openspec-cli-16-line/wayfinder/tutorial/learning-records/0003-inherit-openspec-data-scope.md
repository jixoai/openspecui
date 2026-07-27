# Inherit the OpenSpec data scope

The learner established that OpenSpecUI should not invent a project `.env`, project-local registry, or registry overlay. OpenSpecUI only needs to preserve the launching process's `XDG_DATA_HOME` consistently across its OpenSpec CLI and Agent execution surfaces, leaving data-scope selection to the standard environment contract.

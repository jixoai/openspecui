<!--
  jixoai numbering provider (registry/files/ui/figure/numbering-provider.svelte,
  document-ontology R2 batch 0.3 — the ROUTE-PAGE root provider).

  Creates the TargetRegistry + DomainRegistry instances, publishes
  both contexts, and owns the DOCUMENT-LEVEL MutationObserver:
  onMount observes document.documentElement (childList + subtree)
  and bumps documentRevision through the provider-only inlet;
  teardown disconnects. SSR never observes — documentRevision stays
  0 and the template-order proxy covers the static tree (identical
  to compareDocumentPosition until the first DOM mutation).

  Never mounted in the root/docs layouts (they outlive routes and
  would leak prior-page ids): the +page render tree owns this
  provider, so navigation destroys the registries whole — "a prior
  page's id is unresolvable on the next page" is a test gate.

  Zero-DOM: renders its children and nothing else — a context
  boundary plus an observer lifecycle, not a container.
-->
<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import type { Snippet } from 'svelte';
  import {
    DOCUMENT_DOMAINS_KEY,
    DOCUMENT_TARGETS_KEY,
    createDomainRegistry,
    createTargetRegistry,
  } from './numbering.svelte';

  let { children }: { children: Snippet } = $props();

  const targets = createTargetRegistry();
  const domains = createDomainRegistry();
  setContext(DOCUMENT_TARGETS_KEY, targets);
  setContext(DOCUMENT_DOMAINS_KEY, domains);

  onMount(() => {
    const observer = new MutationObserver(() => domains.notifyDocumentMutation());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  });
</script>

{@render children()}

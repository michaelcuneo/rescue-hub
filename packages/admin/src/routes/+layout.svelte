<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <title>Rescue Hub — NSW Administration</title>
  <meta
    name="description"
    content="NSW wildlife rescue administration and operational oversight."
  />
</svelte:head>

{@render children()}

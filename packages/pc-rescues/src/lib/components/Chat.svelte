<script lang="ts">
	let { chat }: { chat: Chat } = $props();
</script>

<div class="chat">
	<strong>{chat.title}</strong>
	<span>{chat.description}</span>
</div>

<style>
	.chat {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
	}
</style>

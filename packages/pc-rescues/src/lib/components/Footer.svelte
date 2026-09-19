<script lang="ts">
	import ChatPanel from './Chat.svelte';

	const chats: Chat[] = [
		{
			id: '1',
			title: 'Birds',
			description: 'NATF Bird Rescue Chat',
			status: 'active',
			rescueCategory: 'Birds'
		}
	];
</script>

<div class="footer">
	{#each chats as chat}
		<ChatPanel {chat} />
	{/each}
</div>

<style>
	.footer {
		position: fixed;
		bottom: 0px;
		left: 0;
		right: 0;
		height: 50px;
		background: white;
		z-index: 999;
		border: 1px outset rgba(0, 0, 0, 0.2);
		-webkit-box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		-moz-box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
		box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
	}
</style>

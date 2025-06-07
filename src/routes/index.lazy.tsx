import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/")({
	component: Index,
});

function Index() {
	return (
		<div className="p-5">
			<h1 className="text-3xl font-bold underline text-red-400">
				Hello world!
			</h1>
		</div>
	);
}

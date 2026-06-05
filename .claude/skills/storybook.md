# Generate Storybook Component

When I ask you to "generate a story for [ComponentPath]", perform the following:

1. Read the provided React `.tsx` file.
2. Analyze the TypeScript interfaces, specifically looking for `variant`, `size`, or `state` props.
3. Create a sibling file named `[ComponentName].stories.tsx`.
4. Use the modern Storybook `StoryObj` format.
5. Include the `tags: ['autodocs']` parameter in the default Meta export.
6. Generate a separate exported `Story` for every distinct visual variant or state you identified in the props. Do not just generate a default state.

# AI-Powered Text Adventure Game

A web-based text adventure game where players interact with an AI-powered Dungeon Master through natural language inputs. The game creates dynamic stories and quests based on player responses.

## Features

- **Dynamic Storytelling**: The game generates story segments based on player actions and current game context.
- **State Management**: Tracks player location, inventory, and recent events.
- **Session Persistence**: Uses cookies to maintain game sessions across page refreshes.
- **Responsive UI**: Built with Next.js and Shadcn UI components.

## Technologies Used

- **TypeScript**: For type safety across the frontend and backend.
- **Next.js**: React framework for building the web application.
- **Shadcn/UI**: Reusable UI components built with Tailwind CSS.
- **OpenRouter/DeepSeek**: (Optional) AI API for generating dynamic story content.

## Getting Started

### Prerequisites

- Node.js (v18.0.0 or later)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/day-one.git
   cd day-one
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. (Optional) Set up OpenRouter API:
   - Create an account at [OpenRouter](https://openrouter.ai/)
   - Get your API key
   - Create a `.env.local` file in the root directory with:
     ```
     OPENROUTER_API_KEY=your_api_key_here
     ```

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to start your adventure!

## How the Game Works

1. The player enters a response in the UI (e.g., "I explore the forest").
2. The frontend sends the input to a Next.js API route.
3. The API route retrieves the current game state, constructs a prompt, and (optionally) sends it to OpenRouter/DeepSeek.
4. The game processes the AI-generated response and updates the game state.
5. The updated state is returned to the frontend and displayed to the player.

## Development Notes

- The game currently uses a mock AI response system. To enable real AI responses, uncomment the OpenRouter API code in `src/app/api/game/route.ts` and add your API key.
- Game state is stored in-memory for simplicity. For production, consider using a database like Redis or PostgreSQL.

## License

MIT

## Acknowledgements

- Shadcn UI for the beautiful components
- Next.js team for the fantastic framework
- OpenRouter for making AI APIs accessible

import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

interface GameState {
  location: string;
  inventory: string[];
  recentEvents: string[];
  story: string[];
}

// In-memory session store (for prototype simplicity)
// In a production app, you would use a database
const sessions: { [key: string]: GameState } = {};

export async function POST(request: NextRequest) {
  try {
    console.log('API route called with method:', request.method);
    
    const body = await request.json();
    console.log('Request body:', body);
    
    const { action, input } = body;

    // Start a new game
    if (action === 'new') {
      console.log('Starting new game');
      const sessionId = uuidv4();
      const initialState: GameState = {
        location: 'village',
        inventory: [],
        recentEvents: ['You arrived in a quiet village.'],
        story: ['You arrived in a quiet village.'],
      };
      sessions[sessionId] = initialState;
      
      // Set cookie for the client
      const response = NextResponse.json({ state: initialState });
      response.cookies.set('sessionId', sessionId, { 
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
      
      console.log('New game started with session ID:', sessionId);
      return response;
    }

    // Retrieve session ID from cookies
    const sessionId = request.cookies.get('sessionId')?.value;
    console.log('Session ID from cookies:', sessionId);
    
    if (!sessionId || !sessions[sessionId]) {
      console.log('No active session found');
      return NextResponse.json({ error: 'No active session' }, { status: 400 });
    }

    const state = sessions[sessionId];
    console.log('Current state:', { location: state.location, inventory: state.inventory });

    // Handle player response
    if (action === 'respond') {
      console.log('Processing player response:', input);
      const prompt = buildPrompt(state, input);
      console.log('Generated prompt:', prompt);
      
      const llmOutput = await getLLMResponse(prompt);
      console.log('LLM response:', llmOutput);
      
      updateState(state, llmOutput);
      state.story.push(llmOutput);
      
      console.log('Updated state:', { location: state.location, inventory: state.inventory });
      return NextResponse.json({ state });
    } else {
      console.log('Invalid action:', action);
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Construct LLM prompt
function buildPrompt(state: GameState, playerInput: string): string {
  const world = `You are the Dungeon Master for a text adventure game set in a fantasy world with villages, forests, mountains, dungeons, and hidden treasures. The player is on an adventure and exploring this world.`;
  
  const context = `
Current Game State:
- Location: ${state.location}
- Inventory: ${state.inventory.length > 0 ? state.inventory.join(', ') : 'empty'}
- Recent events: ${state.recentEvents.slice(-2).join(' ')}
`;
  
  const action = `The player says: "${playerInput}"`;
  
  const instruction = `
Respond with a vivid, descriptive narrative (2-4 sentences) that advances the story based on the player's input.

Important formatting rules:
1. If the player finds an item, explicitly state "You find {item}" with curly braces around the item name.
2. If the player moves to a new location, explicitly state "You move to *location*" with asterisks around the location name.
3. Include sensory details and create an immersive experience.
4. Keep your response focused and concise.
5. Never break character as the Dungeon Master.
`;
  
  return `${world}\n\n${context}\n\n${action}\n\n${instruction}`;
}

// Fetch response from OpenRouter/DeepSeek
async function getLLMResponse(prompt: string): Promise<string> {
  try {
    // Check if API key is set
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY is not set in environment variables');
      return getFallbackResponse();
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://day-one-adventure-game.vercel.app',
        'X-Title': 'Text Adventure Game'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1:free',
        messages: [
          {
            role: 'system',
            content: `You are a creative Dungeon Master for a text adventure game. 
            
Your responses should be vivid, descriptive, and immersive, using sensory details to bring the fantasy world to life.

IMPORTANT FORMATTING RULES:
- Keep responses between 2-4 sentences for readability
- When the player finds an item, explicitly state "You find {item}" with curly braces around the item name
- When the player moves to a new location, explicitly state "You move to *location*" with asterisks around the location name
- Never break character as the Dungeon Master
- Focus on advancing the story based on player input`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.7
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error calling OpenRouter API:', errorText);
      return getFallbackResponse();
    }
    
    const data = await response.json();
    const responseText = data.choices && data.choices[0]?.message?.content?.trim();
    
    // If response is empty or undefined, use fallback
    if (!responseText) {
      console.warn('Empty response from OpenRouter API, using fallback');
      return getFallbackResponse();
    }
    
    return responseText;
  } catch (error) {
    console.error('Exception calling OpenRouter API:', error);
    return getFallbackResponse();
  }
}

// Fallback responses if the API call fails
function getFallbackResponse(): string {
  const responses = [
    "The village square bustles with activity. Merchants hawk their wares from colorful stalls while children chase each other between the legs of browsing customers. You notice a weathered tavern with a creaking wooden sign to the north and a narrow path leading into dense forest to the east.",
    
    "You move to *forest path*. Sunlight filters through the dense canopy, creating dappled patterns on the forest floor. The air grows cooler as the trees press closer, and you hear rustling in the underbrush nearby—something or someone is watching your progress.",
    
    "You find {rusty iron key} and {pouch of gold coins}. The ornate wooden chest was partially hidden beneath fallen leaves and moss. The key has strange markings etched into its surface, and the leather pouch jingles with the weight of its contents.",
    
    "As twilight descends, you spot a faint amber glow between the trees ahead. Drawing closer, you make out a small cabin with smoke curling from its chimney. The windows are shuttered, but you hear faint humming from within.",
    
    "The village elder approaches, leaning on a gnarled wooden staff. 'Welcome, traveler,' she says, her eyes reflecting wisdom beyond her years. 'Our village has been troubled by strange noises from the forest at night. Would you investigate for us? We fear something dangerous has awakened in the ancient ruins.'",
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

// Update game state based on LLM response
function updateState(state: GameState, response: string) {
  // Format the response for better readability if needed
  const formattedResponse = response.trim();
  console.log('Processing response for state update:', formattedResponse);
  
  // Check for location changes using the new asterisk format
  const locationRegex = /you (?:move|arrive|travel|venture|go|enter|reach|find yourself|step) to \*([\w\s]+)\*/i;
  if (locationRegex.test(formattedResponse)) {
    const match = locationRegex.exec(formattedResponse);
    if (match && match[1]) {
      // Convert location to lowercase to standardize
      state.location = match[1].toLowerCase().trim();
      console.log(`Location updated to: ${state.location}`);
    }
  }
  
  // Check for item acquisition using the new curly brace format
  const itemRegex = /you find \{([\w\s]+)\}/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(formattedResponse)) !== null) {
    if (itemMatch && itemMatch[1]) {
      const item = itemMatch[1].toLowerCase().trim();
      if (!state.inventory.includes(item)) {
        state.inventory.push(item);
        console.log(`Added item to inventory: ${item}`);
      }
    }
  }
  
  // Update recent events
  if (state.recentEvents.length >= 5) {
    state.recentEvents.shift(); // Remove oldest event if we have 5 already
  }
  state.recentEvents.push(formattedResponse);
} 
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
      
      try {
        const llmOutput = await getLLMResponse(prompt);
        console.log('LLM response:', llmOutput);
        
        updateState(state, llmOutput);
        state.story.push(llmOutput);
        
        console.log('Updated state:', { location: state.location, inventory: state.inventory });
        return NextResponse.json({ state });
      } catch (error) {
        console.error('Error getting LLM response:', error);
        // Return a specific error code for LLM failures
        return NextResponse.json({ 
          error: error instanceof Error ? error.message : 'Failed to get AI response. Please try again.',
          retryInput: input // Return the original input so client can retry
        }, { status: 503 }); // 503 Service Unavailable
      }
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

IMPORTANT: Your response MUST be a valid JSON object with the following structure:
{
  "narrative": "Your vivid, descriptive narrative goes here (2-4 sentences)",
  "inventory": ["item1", "item2", "item3"],
  "location": "current_location",
  "recentEvents": ["Most recent event"]
}

Guidelines for the JSON response:
1. The "narrative" field should contain your vivid, descriptive response (2-4 sentences).
2. The "inventory" field should be an array containing ALL items the player has, including both previous items and any new ones.
3. The "location" field should be the player's current location after their action.
4. The "recentEvents" field should contain the most recent significant event.
5. Make sure your JSON is valid and properly formatted with double quotes around keys and string values.
6. Do not include any text outside the JSON object.
`;
  
  return `${world}\n\n${context}\n\n${action}\n\n${instruction}`;
}

// Fetch response from OpenRouter/DeepSeek
async function getLLMResponse(prompt: string): Promise<string> {
  // Check if API key is set
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY is not set in environment variables');
    throw new Error('API key not configured. Please check server configuration.');
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
- Your response MUST be a valid JSON object
- Keep narrative responses between 2-4 sentences for readability
- Include sensory details and create an immersive experience
- Never break character as the Dungeon Master
- Focus on advancing the story based on player input
- Make sure your JSON is properly formatted with double quotes around keys and string values`
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
    throw new Error('Failed to get response from AI service. Please try again.');
  }
  
  const data = await response.json();
  const responseText = data.choices && data.choices[0]?.message?.content?.trim();
  
  // If response is empty or undefined, throw error
  if (!responseText) {
    console.warn('Empty response from OpenRouter API');
    throw new Error('Received empty response from AI service. Please try again.');
  }
  
  return responseText;
}

// Update game state based on LLM response
function updateState(state: GameState, response: string) {
  console.log('Processing response for state update:', response);
  
  try {
    // Try to parse the response as JSON
    let jsonResponse;
    
    // Extract JSON if it's wrapped in markdown code blocks
    if (response.includes('```json')) {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonResponse = JSON.parse(jsonMatch[1]);
      }
    } else {
      // Try to parse the raw response
      jsonResponse = JSON.parse(response);
    }
    
    if (jsonResponse) {
      console.log('Successfully parsed JSON response:', jsonResponse);
      
      // Update narrative in story array
      if (jsonResponse.narrative) {
        state.story[state.story.length - 1] = jsonResponse.narrative;
      }
      
      // Update location if provided
      if (jsonResponse.location) {
        state.location = jsonResponse.location.toLowerCase().trim();
        console.log(`Location updated to: ${state.location}`);
      }
      
      // Update inventory if provided
      if (Array.isArray(jsonResponse.inventory) && jsonResponse.inventory.length > 0) {
        // Replace the entire inventory with the new one
        state.inventory = jsonResponse.inventory.map((item: string) => item.toLowerCase().trim());
        console.log(`Inventory updated to: ${state.inventory.join(', ')}`);
      }
      
      // Update recent events if provided
      if (Array.isArray(jsonResponse.recentEvents) && jsonResponse.recentEvents.length > 0) {
        // Add new events to recent events
        const events: string[] = jsonResponse.recentEvents;
        for (const event of events) {
          if (state.recentEvents.length >= 5) {
            state.recentEvents.shift(); // Remove oldest event if we have 5 already
          }
          state.recentEvents.push(event);
        }
        console.log(`Recent events updated: ${state.recentEvents.join(', ')}`);
      }
      
      return;
    }
  } catch (error) {
    console.error('Error parsing JSON response:', error);
    console.log('Falling back to regex parsing for response');
  }
  
  // Fallback to regex parsing if JSON parsing fails
  const formattedResponse = response.trim();
  
  // Check for location changes using the asterisk format
  const locationRegex = /\*([\w\s]+)\*/gi;
  let locationMatch;
  while ((locationMatch = locationRegex.exec(formattedResponse)) !== null) {
    if (locationMatch && locationMatch[1]) {
      // Convert location to lowercase to standardize
      state.location = locationMatch[1].toLowerCase().trim();
      console.log(`Location updated to: ${state.location}`);
      break; // Only use the first location match
    }
  }
  
  // Check for item acquisition using the curly brace format
  const itemRegex = /\{([\w\s]+)\}/gi;
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
"use client";

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface GameState {
  location: string;
  inventory: string[];
  recentEvents: string[];
  story: string[];
}

export default function Home() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input field function
  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Start a new game on initial load
  useEffect(() => {
    const startGame = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'new' }),
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to start game');
        }
        
        const data = await res.json();
        setGameState(data.state);
        // Focus input after game starts
        setTimeout(focusInput, 100);
      } catch (error) {
        console.error('Error starting game:', error);
        setError('Failed to start the game. Please refresh and try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    startGame();
  }, []);

  // Handle player input submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!input.trim()) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Add the player's input to the story
      setGameState(prev => prev ? {
        ...prev,
        story: [...prev.story, `> ${input}`]
      } : null);
      
      console.log('Sending player input:', input);
      
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'respond', input }),
      });
      
      console.log('Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error response:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          
          // If this is an LLM error (status 503), keep the input for retry
          if (res.status === 503 && errorData.retryInput) {
            // Remove the player's input from the story since we'll retry
            setGameState(prev => prev ? {
              ...prev,
              story: prev.story.slice(0, -1) // Remove the last entry (player input)
            } : null);
            
            // Keep the input in the field for retry
            setInput(errorData.retryInput);
            
            throw new Error(errorData.error || 'AI service unavailable. Please try again.');
          } else {
            // For other errors, clear the input
            setInput('');
            throw new Error(errorData.error || 'Failed to process response');
          }
        } catch (parseError) {
          // Clear input for non-retry errors
          setInput('');
          throw new Error('Failed to process response: ' + errorText);
        }
      }
      
      const data = await res.json();
      console.log('Response data:', data);
      
      setGameState(data.state);
      setInput(''); // Clear input field on success
      
      // Focus input after response is received
      setTimeout(focusInput, 100);
    } catch (error) {
      console.error('Error processing response:', error);
      setError(typeof error === 'object' && error !== null && 'message' in error 
        ? (error as Error).message 
        : 'Something went wrong processing your request. Please try again.');
      
      // Focus input even after error
      setTimeout(focusInput, 100);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press for enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit();
    }
  };

  // Auto-focus when loading state changes
  useEffect(() => {
    if (!isLoading) {
      focusInput();
    }
  }, [isLoading]);

  if (isLoading && !gameState) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-2xl">Loading your adventure...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4 md:p-8 flex flex-col items-center justify-center">
      <div className="container max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-white mb-8">Text Adventure</h1>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded-md mb-4 flex flex-col">
            <div className="mb-2">{error}</div>
            {input && (
              <div className="text-sm text-red-300">
                Your input has been preserved. Click Submit to try again.
              </div>
            )}
          </div>
        )}
        
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur shadow-xl">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-amber-400">Adventure in the Realm</CardTitle>
            <div className="flex flex-wrap gap-4 text-sm mt-2">
              <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-1 rounded-md">
                <span className="font-semibold text-slate-300">Location:</span>
                <span className="text-amber-300 font-medium">{gameState?.location || 'Unknown'}</span>
              </div>
              
              <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-1 rounded-md">
                <span className="font-semibold text-slate-300">Inventory:</span>
                <span className="text-emerald-300 font-medium">
                  {gameState?.inventory.length ? gameState.inventory.join(', ') : 'empty'}
                </span>
              </div>
            </div>
            
            {/* Recent Events Section */}
            {gameState?.recentEvents && gameState.recentEvents.length > 0 && (
              <div className="mt-3 mb-3 bg-slate-700/30 p-3 rounded-md border border-slate-600/50">
                <h3 className="text-sm font-semibold text-slate-300 mb-1">Recent Events:</h3>
                <ul className="text-xs space-y-1">
                  {gameState.recentEvents.map((event, index) => (
                    <li key={index} className="text-amber-200/80">
                      • {typeof event === 'string' && !event.startsWith('{') ? 
                          event.replace(/\*/g, '').replace(/\{|\}/g, '') : 
                          'An event occurred'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="story p-6 max-h-[50vh] overflow-y-auto space-y-4 text-lg leading-relaxed">
              {gameState?.story.map((segment, index) => {
                // Skip segments that look like JSON
                if (segment.trim().startsWith('{') || segment.trim().startsWith('```json')) {
                  return null;
                }
                
                return (
                  <p 
                    key={index} 
                    className={segment.startsWith('>') 
                      ? 'text-sky-300 font-medium italic bg-slate-700/30 p-2 rounded-md' 
                      : 'text-slate-100 bg-slate-800/50 p-3 rounded-md'
                    }
                  >
                    {segment.startsWith('>') 
                      ? segment 
                      : segment
                          // Remove JSON formatting artifacts
                          .replace(/\*/g, '')
                          .replace(/\{|\}/g, '')
                          // Improve readability
                          .split('. ')
                          .join('. ')
                          .replace(/\.\s+/g, '.\n\n')}
                  </p>
                );
              })}
              {isLoading && (
                <p className="text-amber-200 animate-pulse bg-slate-700/30 p-2 rounded-md">
                  The story unfolds...
                </p>
              )}
            </div>
            
            <div className="border-t border-slate-700 p-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="What do you do?"
                  className="flex-1 bg-slate-700 border-slate-600 placeholder:text-slate-400"
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isLoading ? 'Thinking...' : 'Submit'}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

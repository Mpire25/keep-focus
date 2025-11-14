// Focus and productivity quotes for overlays

export const FOCUS_QUOTES = [
  { text: '"The secret of getting ahead is getting started."', author: 'Mark Twain' },
  { text: '"Concentrate all your thoughts upon the work at hand. The sun\'s rays do not burn until brought to a focus."', author: 'Alexander Graham Bell' },
  { text: '"Focus is saying no to a thousand things."', author: 'Steve Jobs' },
  { text: '"The ability to concentrate and to use your time well is everything if you want to succeed in business—or almost anywhere else for that matter."', author: 'Lee Iacocca' },
  { text: '"What you focus on expands, and when you focus on the goodness in your life, you create more of it."', author: 'Oprah Winfrey' },
  { text: '"You can\'t depend on your eyes when your imagination is out of focus."', author: 'Mark Twain' },
  { text: '"The shorter way to do many things is to only do one thing at a time."', author: 'Mozart' },
  { text: '"The successful warrior is the average man, with laser-like focus."', author: 'Bruce Lee' },
  { text: '"Where focus goes, energy flows."', author: 'Tony Robbins' },
  { text: '"The way to get started is to quit talking and begin doing."', author: 'Walt Disney' },
  { text: '"Your attention is one of your most valuable resources. Guard it like a treasure."', author: 'Unknown' },
  { text: '"Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort."', author: 'Paul J. Meyer' },
  { text: '"The successful person has the habit of doing the things failures don\'t like to do."', author: 'Thomas Edison' },
  { text: '"Distraction is the enemy of vision."', author: 'Unknown' },
  { text: '"The more you say no to the things that don\'t matter, the more you can say yes to the things that do."', author: 'Unknown' },
  { text: '"Focus on being productive instead of busy."', author: 'Tim Ferriss' },
  { text: '"The ability to focus attention on important things is a defining characteristic of intelligence."', author: 'Robert J. Shiller' },
  { text: '"Success is the sum of small efforts repeated day in and day out."', author: 'Robert Collier' },
  { text: '"The most precious resource we all have is time."', author: 'Steve Jobs' },
  { text: '"Stay focused, go after your dreams and keep moving toward your goals."', author: 'LL Cool J' }
];

export function getRandomQuote() {
  return FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)];
}


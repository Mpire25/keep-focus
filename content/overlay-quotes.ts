// Focus and productivity quotes for overlays

export interface Quote {
  text: string;
  author: string;
}

export const FOCUS_QUOTES: Quote[] = [
  // Deep Work & Focus
  { text: 'The ability to perform deep work is becoming increasingly rare and increasingly valuable.', author: 'Cal Newport' },
  { text: 'Clarity about what matters provides clarity about what does not.', author: 'Cal Newport' },
  { text: "Efforts to deepen your focus will struggle if you don't simultaneously wean yourself from a dependence on distraction.", author: 'Cal Newport' },
  { text: "What's the most important thing I could be working on right now? If you're not working on it, why not?", author: 'Aaron Swartz' },
  { text: 'Focus is saying no to a thousand things.', author: 'Steve Jobs' },
  { text: "People think focus means saying yes to the thing you've got to focus on. It means saying no to the hundred other good ideas.", author: 'Steve Jobs' },
  { text: 'The main thing is to keep the main thing the main thing.', author: 'Stephen Covey' },

  // Essentialism & Saying No
  { text: "If it's not a hell yes, it's a no.", author: 'Derek Sivers' },
  { text: 'The difference between successful people and really successful people is that really successful people say no to almost everything.', author: 'Warren Buffett' },
  { text: "The more you say no to the things that don't matter, the more you can say yes to the things that do.", author: 'Greg McKeown' },
  { text: "Half of the troubles of this life can be traced to saying yes too quickly and not saying no soon enough.", author: 'Josh Billings' },
  { text: "You don't need more time, you just need to decide.", author: 'Seth Godin' },

  // Execution & Momentum
  { text: 'Done is better than perfect.', author: 'Sheryl Sandberg' },
  { text: "You don't have to be great to start, but you have to start to be great.", author: 'Zig Ziglar' },
  { text: 'Inspiration is for amateurs. The rest of us just show up and get to work.', author: 'Chuck Close' },
  { text: 'Small daily improvements over time lead to stunning results.', author: 'Robin Sharma' },
  { text: 'An idea not coupled with action will never get any bigger than the brain cell it occupied.', author: 'Arnold Glasgow' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },

  // Time & Priorities
  { text: 'Time is the scarcest resource and unless it is managed nothing else can be managed.', author: 'Peter Drucker' },
  { text: 'It is not enough to be busy. The question is: what are we busy about?', author: 'Henry David Thoreau' },
  { text: 'Never mistake motion for action.', author: 'Ernest Hemingway' },
  { text: 'Being busy is a form of laziness — lazy thinking and indiscriminate action.', author: 'Tim Ferriss' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },

  // Stoics
  { text: 'You have power over your mind—not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius' },
  { text: 'The impediment to action advances action. What stands in the way becomes the way.', author: 'Marcus Aurelius' },
  { text: 'Waste no more time arguing about what a good person should be. Be one.', author: 'Marcus Aurelius' },
  { text: 'It is not that we have a short time to live, but that we waste a lot of it.', author: 'Seneca' },
  { text: 'We suffer more often in imagination than in reality.', author: 'Seneca' },
  { text: 'No man is free who is not master of himself.', author: 'Epictetus' },

  // Mindset & Discipline
  { text: 'Motivation gets you going, but discipline keeps you growing.', author: 'John C. Maxwell' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act but a habit.', author: 'Aristotle' },
  { text: 'The successful warrior is the average man, with laser-like focus.', author: 'Bruce Lee' },
  { text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: 'Alexander Graham Bell' },
  { text: 'Genius is one percent inspiration and ninety-nine percent perspiration.', author: 'Thomas Edison' },
  { text: 'Where focus goes, energy flows.', author: 'Tony Robbins' },
];

export function getRandomQuote(): Quote {
  return FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)];
}

const categories = [
  { id: 6, status: 'finished', withTimeCount: 5, total: 5 },
  { id: 10, status: 'finished', withTimeCount: 3, total: 3 },
  { id: 13, status: 'progress', withTimeCount: 1, total: 4 },
  { id: 15, status: 'pending', withTimeCount: 0, total: 2 },
];

let eventToHighlight = [...categories].reverse().find(c => c.withTimeCount > 0);
let nextEvent = null;

if (eventToHighlight) {
  if (eventToHighlight.status === 'finished') {
    nextEvent = categories.find(c => c.status === 'pending' || c.status === 'progress');
  } else {
    const idx = categories.findIndex(c => c.id === eventToHighlight.id);
    nextEvent = categories.slice(idx + 1).find(c => c.total > 0);
  }
} else {
  eventToHighlight = null;
  nextEvent = categories.find(c => c.total > 0);
}

console.log("Top:", eventToHighlight?.id);
console.log("Bottom:", nextEvent?.id);

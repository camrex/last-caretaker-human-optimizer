// data/memories.js
// Memory definitions for The Last Caretaker optimizer.
// Sparse format: only non-zero numeric traits are stored.

var MEMORIES = [
  { id:1, name:"Basketball", rank:1, patience:1 },
  { id:2, name:"Bowling Ball", rank:1, patience:1 },
  { id:3, name:"Bowling Pin", rank:1, patience:1 },
  { id:4, name:"Crayon", rank:2, creativity:5, focus:2, tooltip:"Color application tool. Creates visual patterns, requires minimal control, introduces color mixing concepts." },
  { id:5, name:"Meditation", rank:2, focus:5, tooltip:"Mindfulness guide promoting desciplined habits, emotional control, sustained focus, self-awareness." },
  { id:6, name:"Mirror", rank:2, empathy:5, tooltip:"Reflective surface capturing silent truths, questioning existence." },
  { id:7, name:"Mystery Box", rank:2, patience:5, tooltip:"More questions are raised than are ever answered. Midday 1st Sat in Aug." },
  { id:8, name:"Small Human Art", rank:2, empathy:5, tooltip:"Early communication artifacts. Shows basic patterns, emotional expression attempts, demonstrates early communication." },
  { id:9, name:"Stopwatch", rank:2, patience:5, tooltip:"Time measurement device. Tracks action durations, marks completion, and supports waiting protocols." },
  { id:10, name:"Teddy Bear (Brown)", rank:2, empathy:3, tooltip:"Orange scarf symbolizes safety; survives in wastelands, echoing past warmth." },
  { id:11, name:"Teddy Bear (White)", rank:2, empathy:3, tooltip:"Former protector, now a quiet traveler of ocean landscapes carrying memories." },
  { id:12, name:"Tommy", rank:2, empathy:3, tooltip:"Soft synthetic companion shaped like a Tommy the t-rex. Provides comfort, supports emotional stability, and encourages safe bonding." },
  { id:13, name:"Assembly Instructions", rank:3, discipline:2, logic:8, tooltip:"Sequential diagrams guiding assembly. Shows correct order, directional markers, and requires step-by-step interpretation." },
  { id:14, name:"Biology Notes", rank:3, wisdom:10, tooltip:"Journal with species sketches. Documents lifeforms, requires monitoring of populations, records environmental decline." },
  { id:15, name:"Camera", rank:3, comms:5, creativity:5, tooltip:"Device capturing visual data. Records moving and static subject, requires understanding of light, and preserves moments." },
  { id:16, name:"Cards", rank:3, comms:5, empathy:5, tooltip:"Printed message cards. Transmit emotional patterns, contain communcation symbols, initiate basic connections." },
  { id:17, name:"First Aid", rank:3, adaptability:10, tooltip:"Essential health guide with disciplined protocols, clear procedures, systematic, adaptable responses." },
  { id:18, name:"Guitar", rank:3, comms:3, creativity:3, focus:3, tooltip:"Sound device creating patterns through finger placement, teaches sequences, enables tonal communication." },
  { id:19, name:"Love Letters", rank:3, wisdom:10, tooltip:"Old written communications. Shows relationship patterns over time, reveals emotional connections and personal history." },
  { id:20, name:"Music Notes", rank:3, comms:4, creativity:6, tooltip:"Symbols on staffs indicating sound sequiences. Guides pitch, rhythm accuracy, enables coordinated audio reproduction." },
  { id:21, name:"Programming Manual", rank:3, logic:10, tooltip:"Structured guide teaching algorithms, logical reasoning, disciplined thinking and D-Team Failure generation." },
  { id:22, name:"Small Tree", rank:3, discipline:5, patience:5, tooltip:"Living plant in container. Needs repeated small adjustments, demonstrates growth patterns, shows care results over time." },
  { id:23, name:"Sudoku Book", rank:3, logic:10, tooltip:"Numerical logic puzzles enhance reasoning, pattern recognition, sustained focus, systematic problem-solving." },
  { id:24, name:"Travel Journal", rank:3, adaptability:10, tooltip:"Written movement records. Contains locations and experiences, documents adaptation, stores environmental responses." },
  { id:25, name:"Where's Tommy", rank:3, focus:5, patience:5, tooltip:"Visual search book fostering detailed observation, sustained attention, patience, focus." },
  { id:26, name:"Blueprints", rank:4, adaptability:10, logic:5, tooltip:"Technical drawings of increasing complexity. Reveal structural relationships, require sustained investigation, enable analysis." },
  { id:27, name:"Cognitive Cards", rank:4, adaptability:7, logic:5, wisdom:3, tooltip:"Cards demonstrating solving methods. Require sustained focus, develop logical deduction skills." },
  { id:28, name:"Commander's Log", rank:4, discipline:7, leadership:8, tooltip:"Written strategic records. Documents decisions and outcomes, shows leadership patterns, requires systematic logging." },
  { id:29, name:"Compass", rank:4, adaptability:6, focus:3, leadership:3, tooltip:"Magnetic navigation tool. Shows orientation, needs environmental interpretation, aids directional planning." },
  { id:30, name:"Encyclopedia", rank:4, logic:5, wisdom:10, tooltip:"Bound paper sheets storing symbols and images. Explains reality, organized sequentially, information processing." },
  { id:31, name:"Maps", rank:4, leadership:5, wisdom:10, tooltip:"Visual geographic representations. Indicates spatial relationships, navigational routes, requires symbolic marker interpretation." },
  { id:32, name:"Plans", rank:4, comms:8, discipline:7, tooltip:"Coordinated action diagrams. Show planned sequences, require understanding multi-unit operations." },
  { id:33, name:"Survival Diagrams", rank:4, adaptability:10, leadership:5, tooltip:"Photos documenting crisis adaptations. Records resourceful solutions, demonstrates resilient behaviours." },
  { id:34, name:"The Art of War", rank:4, comms:5, leadership:10, tooltip:"Ancient leadership and strategy manual. Offers tactical insights, disciplined planning, clear communication, adaptive thinking." },
  { id:35, name:"Ash Notebook", rank:5, adaptability:100, comms:100, creativity:100, discipline:100, empathy:100, focus:100, leadership:100, logic:100, patience:100, wisdom:100, tooltip:"Personal journal from previous Transposium occupants." },
  { id:36, name:"Star Child Memory", rank:5, starChild:1, tooltip:"Star Child Memory." }
];

// Artifact memories flagged for the exclude toggle
var ARTIFACT_MEMORIES = ["Ash Notebook", "Star Child Memory"];

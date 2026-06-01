import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Trophy, Play, SkipForward, Share2, RefreshCw, Users, Sparkles, ExternalLink, ArrowLeft, Volume2, VolumeX, Tv
} from "lucide-react";
import { useToast } from "./ui/Toast.tsx";
import { supabase } from "../lib/supabaseClient.ts";

interface Competitor {
  id: string;
  name: string;
  institutionName: string;
  logoUrl?: string;
}

interface DrawStep {
  competitor: Competitor;
  destination: string; // e.g. "Grupo A", "Chave 1 (Posição A)"
  groupLabel?: string;
  matchIndex?: number;
  positionIndex?: number; // 0 for team1/roster1, 1 for team2/roster2
}

// Simple local audio generator for retro synth-pop sound effects using Web Audio API
const playSound = (type: 'bounce' | 'reveal' | 'success' | 'click') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'bounce') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'reveal') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(220, ctx.currentTime);
      osc1.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.4);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(225, ctx.currentTime);
      osc2.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.4);
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.5);
      osc2.stop(ctx.currentTime + 0.5);
    } else if (type === 'success') {
      // Arpeggio
      const notes = [261.63, 329.63, 392.00, 523.25];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0.06, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.3);
      });
    }
  } catch (e) {
    console.warn("Audio Context blocked or failed:", e);
  }
};

// Custom Confetti Component
const ConfettiRain = () => {
  const pieces = useMemo(() => {
    return Array.from({ length: 120 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage
      y: -10 - Math.random() * 40,
      size: 5 + Math.random() * 12,
      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4'][Math.floor(Math.random() * 7)],
      delay: Math.random() * 6,
      duration: 3 + Math.random() * 4,
      rotation: Math.random() * 360,
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ 
            x: `${p.x}vw`, 
            y: `${p.y}vh`, 
            rotate: p.rotation,
            opacity: 1 
          }}
          animate={{ 
            y: '105vh', 
            rotate: p.rotation + 720,
            opacity: [1, 1, 0]
          }}
          transition={{ 
            duration: p.duration, 
            delay: p.delay,
            ease: "linear",
            repeat: Infinity
          }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === 'circle' ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
};

export default function DrawCeremony() {
  const { id: tournamentId, categoryId } = useParams();
  const { success: toastSuccess } = useToast();
  
  const [tournament, setTournament] = useState<any>(null);
  const [category, setCategory] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Draw State Machine: 'idle' | 'drawing' | 'revealing' | 'placing' | 'completed'
  const [drawStatus, setDrawStatus] = useState<'idle' | 'drawing' | 'revealing' | 'placing' | 'completed'>('idle');
  const [drawSteps, setDrawSteps] = useState<DrawStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [drawnCompetitorIds, setDrawnCompetitorIds] = useState<Set<string>>(new Set());
  const [autoPlay, setAutoPlay] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);

  // Urna (Lottery Bowl) physical simulation state helpers
  const [balls, setBalls] = useState<Array<{ id: number; color: string; x: number; y: number; vx: number; vy: number }>>([]);
  const animFrameRef = useRef<number | null>(null);

  // Grouped structure representing active visual slots
  const [groupsData, setGroupsData] = useState<Record<string, Array<Competitor | null>>>({});
  const [bracketMatches, setBracketMatches] = useState<any[]>([]);

  // 1. Initial Data Load
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch tournament
        const tRes = await fetch(`/api/tournaments/${tournamentId}`);
        const tData = await tRes.json();
        setTournament(tData);

        // Fetch categories to get this specific one
        const cRes = await fetch(`/api/tournaments/${tournamentId}/categories`);
        const cData = await cRes.json();
        const activeCat = cData.find((c: any) => c.id === categoryId);
        setCategory(activeCat);

        // Fetch matches
        const mRes = await fetch(`/api/tournaments/${tournamentId}/categories/${categoryId}/matches`);
        const mData = await mRes.json();
        const phase1Matches = mData.filter((m: any) => m.phase_index === 1);
        setMatches(phase1Matches);

        // Fetch teams list
        const teamsRes = await fetch(`/api/tournaments/${tournamentId}/categories/${categoryId}/teams`);
        const teamsData = await teamsRes.json();
        
        let loadedCompetitors: Competitor[] = [];
        const isCombat = activeCat?.rules_config?.sport_type === "combat";

        if (isCombat) {
          // If combat, fetch approved athlete subscriptions
          const subsRes = await fetch(`/api/tournaments/${tournamentId}/athlete-subscriptions`);
          const subsData = await subsRes.json();
          const approvedSubs = subsData.filter((s: any) => s.category_id === categoryId && s.validation_status === "approved");
          
          loadedCompetitors = approvedSubs.map((s: any) => ({
            id: s.id,
            name: s.athlete_name,
            institutionName: s.institution?.name || "Avulso"
          }));
        } else {
          loadedCompetitors = teamsData.map((t: any) => ({
            id: t.id,
            name: t.institution?.name || "Sem Nome",
            institutionName: t.institution?.name || "Instituição"
          }));
        }

        setCompetitors(loadedCompetitors);

        if (phase1Matches.length > 0) {
          const isGroupSystem = phase1Matches.every((m: any) => m.next_match_id === null && m.round === 1);
          const system = isGroupSystem ? "groups" : "single";
          const steps: DrawStep[] = [];
          
          if (system === "groups") {
            // Group unique label strings (e.g. "Grupo A", "Grupo B")
            const groupLabels = Array.from(new Set(phase1Matches.map((m: any) => m.group_label).filter(Boolean))).sort() as string[];
            
            // Collect members in each group from phase matches
            const groupMembers: Record<string, string[]> = {};
            
            groupLabels.forEach(label => {
              const delimiterRegex = /\s+[xX]\s+/;
              if (delimiterRegex.test(label)) {
                const parts = label.split(delimiterRegex);
                const leftName = parts[0].trim();
                const rightName = parts[1].trim();

                if (!groupMembers[leftName]) groupMembers[leftName] = [];
                if (!groupMembers[rightName]) groupMembers[rightName] = [];

                const groupMatches = phase1Matches.filter((m: any) => m.group_label === label);
                groupMatches.forEach((m: any) => {
                  if (isCombat) {
                    if (m.roster1?.athlete_id) groupMembers[leftName].push(m.roster1.athlete_id);
                    if (m.roster2?.athlete_id) groupMembers[rightName].push(m.roster2.athlete_id);
                  } else {
                    if (m.team1_id) groupMembers[leftName].push(m.team1_id);
                    if (m.team2_id) groupMembers[rightName].push(m.team2_id);
                  }
                });
              } else {
                groupMembers[label] = [];
                const groupMatches = phase1Matches.filter((m: any) => m.group_label === label);
                groupMatches.forEach((m: any) => {
                  if (isCombat) {
                    if (m.roster1?.athlete_id) groupMembers[label].push(m.roster1.athlete_id);
                    if (m.roster2?.athlete_id) groupMembers[label].push(m.roster2.athlete_id);
                  } else {
                    if (m.team1_id) groupMembers[label].push(m.team1_id);
                    if (m.team2_id) groupMembers[label].push(m.team2_id);
                  }
                });
              }
            });

            // Deduplicate all group members
            Object.keys(groupMembers).forEach(k => {
              groupMembers[k] = Array.from(new Set(groupMembers[k]));
            });

            // Initialize visual empty slots
            const initialGroups: Record<string, Array<Competitor | null>> = {};
            Object.keys(groupMembers).forEach(label => {
              const size = groupMembers[label].length;
              initialGroups[label] = Array(size).fill(null);
            });
            setGroupsData(initialGroups);

            // Reconstruct sequential draw slots
            // Draw alternatingly: Pos 0 Group A, Pos 0 Group B, Pos 1 Group A, Pos 1 Group B ...
            const sortedGroupKeys = Object.keys(groupMembers).sort();
            const maxGroupSize = Math.max(...Object.values(groupMembers).map(g => g.length), 0);
            for (let posIdx = 0; posIdx < maxGroupSize; posIdx++) {
              sortedGroupKeys.forEach(label => {
                const competitorId = groupMembers[label][posIdx];
                if (competitorId) {
                  const compObj = loadedCompetitors.find(c => c.id === competitorId);
                  if (compObj) {
                    const cleanDest = label.toLowerCase().includes("grupo") ? label : `Grupo ${label}`;
                    steps.push({
                      competitor: compObj,
                      destination: cleanDest,
                      groupLabel: label,
                      positionIndex: posIdx
                    });
                  }
                }
              });
            }
          } else {
            // Single Elimination system
            // Round 1 matches sorted by match_index
            const round1Matches = phase1Matches.filter((m: any) => m.round === 1).sort((a: any, b: any) => a.match_index - b.match_index);
            
            // Visual display bracket initialize (contain all matches of phase 1)
            setBracketMatches(phase1Matches.map((m: any) => ({
              ...m,
              renderedTeam1: null,
              renderedTeam2: null
            })));

            // Reconstruct draw: Match 0 Team 1, Match 0 Team 2, Match 1 Team 1...
            round1Matches.forEach((m: any) => {
              const compId1 = isCombat ? m.roster1?.athlete_id : m.team1_id;
              const compId2 = isCombat ? m.roster2?.athlete_id : m.team2_id;

              if (compId1) {
                const comp = loadedCompetitors.find(c => c.id === compId1);
                if (comp) {
                  steps.push({
                    competitor: comp,
                    destination: `Confronto ${m.match_index + 1} - Canto Superior`,
                    matchIndex: m.match_index,
                    positionIndex: 0
                  });
                }
              }
              if (compId2) {
                const comp = loadedCompetitors.find(c => c.id === compId2);
                if (comp) {
                  steps.push({
                    competitor: comp,
                    destination: `Confronto ${m.match_index + 1} - Canto Inferior`,
                    matchIndex: m.match_index,
                    positionIndex: 1
                  });
                }
              }
            });
          }
          
          setDrawSteps(steps);
        }

      } catch (err) {
        console.error("Failed to load draw ceremony data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tournamentId, categoryId]);

  // 2. Urgent Ball Physics setup inside Lottery Cage
  useEffect(() => {
    // Generate initial balls representing competitors
    if (competitors.length > 0 && drawStatus === 'idle') {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#14b8a6'];
      const initialBalls = competitors.map((c, i) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 40;
        return {
          id: i,
          color: colors[i % colors.length],
          // Start within cage center (r=60)
          x: 100 + Math.cos(angle) * radius,
          y: 100 + Math.sin(angle) * radius,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6
        };
      });
      setBalls(initialBalls);
    }
  }, [competitors, drawStatus]);

  // Physics animation loop for tumbling balls
  useEffect(() => {
    if (drawStatus === 'drawing' || (drawStatus === 'idle' && balls.length > 0)) {
      const updatePhysics = () => {
        setBalls(prevBalls => {
          return prevBalls.map(ball => {
            let nextVx = ball.vx;
            let nextVy = ball.vy;

            // Cage center (100, 100) and radius (85) boundary check
            const dx = (ball.x + ball.vx) - 100;
            const dy = (ball.y + ball.vy) - 100;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const maxRadius = 78; // Ball size buffer

            if (distance > maxRadius) {
              // Elastic collision with circular wall
              const nx = dx / distance;
              const ny = dy / distance;
              // Reflect velocity vector
              const dotProduct = ball.vx * nx + ball.vy * ny;
              nextVx = (ball.vx - 2 * dotProduct * nx) * 0.95;
              nextVy = (ball.vy - 2 * dotProduct * ny) * 0.95;

              // Push back inside boundary slightly
              return {
                ...ball,
                vx: nextVx,
                vy: nextVy,
                x: 100 + nx * maxRadius,
                y: 100 + ny * maxRadius
              };
            }

            // Gravity & Friction
            nextVy += 0.15; // Gravity
            nextVx *= 0.99; // Air resistance
            nextVy *= 0.99;

            // Add random speed kick if actively tumbling/mixing
            if (drawStatus === 'drawing') {
              nextVx += (Math.random() - 0.5) * 1.5;
              nextVy += (Math.random() - 0.5) * 1.5;
            }

            return {
              ...ball,
              x: ball.x + nextVx,
              y: ball.y + nextVy,
              vx: nextVx,
              vy: nextVy
            };
          });
        });
        animFrameRef.current = requestAnimationFrame(updatePhysics);
      };
      animFrameRef.current = requestAnimationFrame(updatePhysics);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawStatus, balls.length]);

  // 3. Draw trigger logic
  const handleDrawNext = () => {
    if (drawStatus === 'drawing' || drawStatus === 'revealing' || drawStatus === 'placing') return;
    if (currentStepIndex >= drawSteps.length - 1) return;

    if (soundEnabled) playSound('click');
    setDrawStatus('drawing');
    
    // Mix and roll the cage for 1.8 seconds before popping out a ball
    let interval: any = null;
    if (soundEnabled) {
      interval = setInterval(() => playSound('bounce'), 250);
    }

    setTimeout(() => {
      if (interval) clearInterval(interval);
      
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      setDrawStatus('revealing');
      if (soundEnabled) playSound('reveal');

      // Pop the ball out physically
      setBalls(prev => prev.slice(1)); // Remove one ball from visual cage

      // Show flip card reveal, then place team automatically
      setTimeout(() => {
        setDrawStatus('placing');
        
        // Place the drawn team in their respective slot
        const step = drawSteps[nextIndex];
        
        if (step.groupLabel) {
          setGroupsData(prev => {
            const arr = [...prev[step.groupLabel!]];
            arr[step.positionIndex!] = step.competitor;
            return { ...prev, [step.groupLabel!]: arr };
          });
        } else if (step.matchIndex !== undefined) {
          setBracketMatches(prev => {
            return prev.map(m => {
              if (m.match_index === step.matchIndex && m.round === 1) {
                if (step.positionIndex === 0) {
                  return { ...m, renderedTeam1: step.competitor };
                } else {
                  return { ...m, renderedTeam2: step.competitor };
                }
              }
              return m;
            });
          });
        }

        setDrawnCompetitorIds(prev => {
          const next = new Set(prev);
          next.add(step.competitor.id);
          return next;
        });

        // End of single step
        setTimeout(() => {
          if (nextIndex === drawSteps.length - 1) {
            setDrawStatus('completed');
            if (soundEnabled) playSound('success');
          } else {
            setDrawStatus('idle');
          }
        }, 800);

      }, 2500);

    }, 1800);
  };

  // Skip the draw entirely to instantly view result
  const handleSkipAll = () => {
    if (soundEnabled) playSound('success');
    
    // Assign all steps instantly
    setGroupsData(prev => {
      const next = { ...prev };
      drawSteps.forEach(step => {
        if (step.groupLabel) {
          if (!next[step.groupLabel]) next[step.groupLabel] = [];
          next[step.groupLabel][step.positionIndex!] = step.competitor;
        }
      });
      return next;
    });

    setBracketMatches(prev => {
      return prev.map(m => {
        if (m.round === 1) {
          const step1 = drawSteps.find(s => s.matchIndex === m.match_index && s.positionIndex === 0);
          const step2 = drawSteps.find(s => s.matchIndex === m.match_index && s.positionIndex === 1);
          return {
            ...m,
            renderedTeam1: step1 ? step1.competitor : m.renderedTeam1,
            renderedTeam2: step2 ? step2.competitor : m.renderedTeam2
          };
        }
        return m;
      });
    });

    setDrawnCompetitorIds(new Set(competitors.map(c => c.id)));
    setCurrentStepIndex(drawSteps.length - 1);
    setBalls([]);
    setDrawStatus('completed');
  };

  // Reset/Restart animation locally
  const handleResetAnimation = () => {
    if (soundEnabled) playSound('click');
    setDrawStatus('idle');
    setCurrentStepIndex(-1);
    setDrawnCompetitorIds(new Set());
    setAutoPlay(false);

    // Reset visual slots
    const isGroupSystem = matches.every((m: any) => m.next_match_id === null && m.round === 1);
    const system = isGroupSystem ? "groups" : "single";
    if (system === "groups") {
      setGroupsData(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          next[k] = Array(next[k].length).fill(null);
        });
        return next;
      });
    } else {
      setBracketMatches(prev => {
        return prev.map(m => ({ ...m, renderedTeam1: null, renderedTeam2: null }));
      });
    }
  };

  // AutoPlay loop trigger
  useEffect(() => {
    if (autoPlay && drawStatus === 'idle') {
      const timeout = setTimeout(() => {
        handleDrawNext();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [autoPlay, drawStatus]);

  const syncState = (targetIndex: number, status: string, autoPlayVal: boolean) => {
    if (targetIndex < 0) {
      handleResetAnimation();
      setIsSyncing(false);
      return;
    }

    const isGroupSystem = matches.every((m: any) => m.next_match_id === null && m.round === 1);
    const system = isGroupSystem ? "groups" : "single";
    
    let nextGroupsData: any = {};
    if (system === "groups") {
      Object.keys(groupsData).forEach(k => {
        nextGroupsData[k] = Array(groupsData[k].length).fill(null);
      });
    }

    let nextBracketMatches = bracketMatches.map(m => ({
      ...m,
      renderedTeam1: null,
      renderedTeam2: null
    }));

    const nextDrawnIds = new Set<string>();

    for (let i = 0; i <= targetIndex; i++) {
      const step = drawSteps[i];
      if (!step) continue;
      nextDrawnIds.add(step.competitor.id);

      if (step.groupLabel) {
        if (!nextGroupsData[step.groupLabel]) {
          nextGroupsData[step.groupLabel] = [];
        }
        nextGroupsData[step.groupLabel][step.positionIndex!] = step.competitor;
      } else if (step.matchIndex !== undefined) {
        nextBracketMatches = nextBracketMatches.map(m => {
          if (m.match_index === step.matchIndex && m.round === 1) {
            if (step.positionIndex === 0) {
              return { ...m, renderedTeam1: step.competitor };
            } else {
              return { ...m, renderedTeam2: step.competitor };
            }
          }
          return m;
        });
      }
    }

    if (system === "groups") {
      setGroupsData(nextGroupsData);
    } else {
      setBracketMatches(nextBracketMatches);
    }
    setDrawnCompetitorIds(nextDrawnIds);
    setCurrentStepIndex(targetIndex);
    setAutoPlay(autoPlayVal);

    if (status === 'completed' || targetIndex === drawSteps.length - 1) {
      setDrawStatus('completed');
      setBalls([]);
    } else {
      setDrawStatus('idle');
      
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#14b8a6'];
      const initialBalls = competitors.map((c, i) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 40;
        return {
          id: i,
          color: colors[i % colors.length],
          x: 100 + Math.cos(angle) * radius,
          y: 100 + Math.sin(angle) * radius,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6
        };
      });
      setBalls(initialBalls.slice(targetIndex + 1));
    }
    setIsSyncing(false);
  };

  // Refs for handlers to avoid stale closures in Supabase Realtime event handler
  const drawStatusRef = useRef(drawStatus);
  const currentStepIndexRef = useRef(currentStepIndex);
  const drawnCompetitorIdsRef = useRef(drawnCompetitorIds);
  const competitorsRef = useRef(competitors);
  const autoPlayRef = useRef(autoPlay);
  const isSyncingRef = useRef(isSyncing);
  const syncStateRef = useRef(syncState);
  const handleDrawNextRef = useRef(handleDrawNext);
  const handleSkipAllRef = useRef(handleSkipAll);
  const handleResetAnimationRef = useRef(handleResetAnimation);
  const setAutoPlayRef = useRef(setAutoPlay);

  useEffect(() => {
    drawStatusRef.current = drawStatus;
    currentStepIndexRef.current = currentStepIndex;
    drawnCompetitorIdsRef.current = drawnCompetitorIds;
    competitorsRef.current = competitors;
    autoPlayRef.current = autoPlay;
    isSyncingRef.current = isSyncing;
    syncStateRef.current = syncState;
    handleDrawNextRef.current = handleDrawNext;
    handleSkipAllRef.current = handleSkipAll;
    handleResetAnimationRef.current = handleResetAnimation;
    setAutoPlayRef.current = setAutoPlay;
  });

  // Listen to organizer control broadcasts and handle sync requests
  useEffect(() => {
    if (!categoryId) return;
    const channel = supabase.channel(`draw_ceremony_${categoryId}`);

    channel
      .on('broadcast', { event: 'organizer_action' }, ({ payload }) => {
        const { action } = payload;
        if (action === 'start' || action === 'next') {
          handleDrawNextRef.current();
        } else if (action === 'skip') {
          handleSkipAllRef.current();
        } else if (action === 'reset') {
          handleResetAnimationRef.current();
        } else if (action === 'toggle_autoplay') {
          setAutoPlayRef.current(prev => !prev);
        }
      })
      .on('broadcast', { event: 'request_state' }, () => {
        // If we are NOT syncing, we can broadcast our state to the late-joiner
        if (!isSyncingRef.current && currentStepIndexRef.current !== -1) {
          channel.send({
            type: 'broadcast',
            event: 'public_state',
            payload: {
              status: drawStatusRef.current,
              currentStepIndex: currentStepIndexRef.current,
              drawnCount: drawnCompetitorIdsRef.current.size,
              totalCount: competitorsRef.current.length,
              autoPlay: autoPlayRef.current
            }
          });
        }
      })
      .on('broadcast', { event: 'public_state' }, ({ payload }) => {
        // If we are syncing, catch up to the broadcasted state
        if (isSyncingRef.current) {
          syncStateRef.current(payload.currentStepIndex, payload.status, payload.autoPlay);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryId]);

  // Broadcast current state to the organizer in real-time
  useEffect(() => {
    if (!categoryId || loading || isSyncing) return;
    const channel = supabase.channel(`draw_ceremony_${categoryId}`);

    const broadcastState = () => {
      channel.send({
        type: 'broadcast',
        event: 'public_state',
        payload: {
          status: drawStatus,
          currentStepIndex,
          drawnCount: drawnCompetitorIds.size,
          totalCount: competitors.length,
          autoPlay
        }
      });
    };

    // Broadcast state on mount and when changes occur
    broadcastState();

    // Heartbeat interval to keep late-connecting organizers updated
    const interval = setInterval(broadcastState, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [categoryId, drawStatus, currentStepIndex, drawnCompetitorIds.size, competitors.length, autoPlay, loading, isSyncing]);

  // Request current state on mount and handle fallback/timeout
  useEffect(() => {
    if (loading) return;

    const channel = supabase.channel(`draw_ceremony_${categoryId}`);
    
    // Request state after subscription is ready
    const subTimeout = setTimeout(() => {
      channel.send({
        type: 'broadcast',
        event: 'request_state',
        payload: {}
      });
    }, 600);

    // Timeout fallback if no active sync state is received
    const syncTimeout = setTimeout(() => {
      if (isSyncingRef.current) {
        setIsSyncing(false);
        // If no organizer/screen is active, and matches exist, show final result
        if (currentStepIndexRef.current === -1) {
          handleSkipAllRef.current();
        }
      }
    }, 2800);

    return () => {
      clearTimeout(subTimeout);
      clearTimeout(syncTimeout);
    };
  }, [categoryId, loading]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toastSuccess("Link do sorteio copiado com sucesso! Compartilhe com os atletas.");
  };

  if (loading || isSyncing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <RefreshCw className="animate-spin text-indigo-500 mb-4" size={40} />
        <p className="font-bold text-slate-350 tracking-wide text-sm">
          {loading ? "Carregando detalhes do sorteio..." : "Sincronizando com a transmissão ao vivo..."}
        </p>
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <Trophy size={64} className="text-slate-500 mb-4 animate-pulse" />
        <h2 className="text-2xl font-bold tracking-tight text-white">Sorteio Não Disponível</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-md leading-relaxed">
          O organizador do torneio ainda não gerou as chaves ou grupos desta categoria. Por favor, aguarde o sorteio oficial ser realizado.
        </p>
        <Link to={`/public/tournament/${tournamentId}`} className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
          <ArrowLeft size={16} /> Voltar para o Torneio
        </Link>
      </div>
    );
  }

  const currentStep = currentStepIndex >= 0 ? drawSteps[currentStepIndex] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden relative flex flex-col">
      {/* Background ambient lighting */}
      <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[60%] rounded-full bg-violet-600/10 blur-[150px]" />

      {/* Confetti celebration */}
      {drawStatus === 'completed' && <ConfettiRain />}

      {/* Header bar */}
      <header className="h-16 px-4 md:px-8 flex items-center justify-between border-b border-white/5 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link to={`/public/tournament/${tournamentId}`} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition cursor-pointer">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">{tournament?.name}</h1>
            <p className="text-sm font-extrabold text-white mt-1 leading-none">{category?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)} 
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
            title={soundEnabled ? "Desativar Sons" : "Ativar Sons"}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button 
            onClick={handleShare} 
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Share2 size={14} /> Compartilhar
          </button>
        </div>
      </header>

      {/* Body Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-4 md:p-8 max-w-7xl mx-auto w-full">
        
        {/* Left Side: Lottery Cage & Interactive Control (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm relative overflow-hidden h-[580px] lg:sticky lg:top-24">
          
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full">
              Sorteio Oficial
            </span>
            <h3 className="text-lg font-black text-white mt-3">Urna de Competidores</h3>
            <p className="text-xs text-slate-400 mt-1">Clique para retirar as bolinhas e montar a tabela</p>
          </div>

          {/* Spherical Lottery Cage container */}
          <div className="flex items-center justify-center my-6 relative">
            
            {/* The Glass Dome */}
            <div className="w-[200px] h-[200px] rounded-full border border-white/20 bg-white/5 shadow-[inset_0_4px_30px_rgba(255,255,255,0.1)] backdrop-blur-xs relative overflow-hidden flex items-center justify-center">
              
              {/* Spinning cage axis */}
              <div className="absolute inset-2 rounded-full border border-white/5 border-dashed animate-[spin_10s_linear_infinite]" />
              
              {/* Render physics simulated balls */}
              {balls.map((b) => (
                <motion.div
                  key={b.id}
                  className="absolute rounded-full shadow-lg"
                  style={{
                    width: '20px',
                    height: '20px',
                    left: `${b.x}px`,
                    top: `${b.y}px`,
                    background: `radial-gradient(circle at 6px 6px, #ffffff 0%, ${b.color} 50%, #000000 100%)`,
                    boxShadow: `0 4px 10px ${b.color}40`,
                  }}
                  layout
                />
              ))}

              {/* Urna base / stand inside the dome */}
              <div className="absolute bottom-2 w-16 h-8 bg-slate-900/60 rounded-t-xl border-t border-white/10 flex items-center justify-center text-[9px] font-bold text-slate-500 tracking-wider">
                FIFA
              </div>
            </div>
            
            {/* Pop out tunnel/tube */}
            <div className="absolute bottom-[-15px] w-8 h-12 bg-gradient-to-b from-white/10 to-transparent border-x border-white/10 rounded-b-lg flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-slate-800 border border-white/10" />
            </div>
          </div>

          {/* Action buttons - HIDE in public view, display only connection badge */}
          <div className="space-y-3 z-10">
            <div className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 py-4 px-3 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-2 text-center shadow-inner">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-wider">📡 Controle Realtime Ativo</span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 max-w-[220px] mt-1 leading-normal">
                Esta tela pública está sincronizada e sendo controlada diretamente pelo painel do organizador.
              </p>
            </div>

            {/* Competitor draw progress tracker */}
            <div className="pt-4 border-t border-white/5 text-center">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Sorteados: {drawnCompetitorIds.size} de {competitors.length}
              </p>
              <div className="w-full bg-white/5 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(drawnCompetitorIds.size / competitors.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Visual Slots showing structure (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col">
          
          <div className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm flex-1">
            <h3 className="text-base font-black text-white mb-6 flex items-center gap-2">
              <Trophy size={18} className="text-amber-500" />
              Chaveamento / Grupos em Tempo Real
            </h3>

            {/* RENDER GROUPS SYSTEM */}
            {matches.every((m: any) => m.next_match_id === null && m.round === 1) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(groupsData).map((label) => {
                  const list = groupsData[label];
                  return (
                    <div key={label} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 overflow-hidden relative">
                      <h4 className="text-sm font-black text-white mb-4 bg-indigo-600/20 text-indigo-400 py-1.5 px-3 rounded-lg border border-indigo-500/10 inline-block">
                        {label.toLowerCase().includes("grupo") ? label : `Grupo ${label}`}
                      </h4>
                      
                      <div className="space-y-2">
                        {list.map((c, idx) => (
                          <div 
                            key={idx} 
                            className={`h-12 px-4 rounded-xl border flex items-center justify-between transition-all duration-300 ${
                              c 
                                ? 'bg-slate-800/80 border-slate-700/80' 
                                : 'bg-white/2 border-white/5 border-dashed'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-slate-500">#{idx + 1}</span>
                              {c ? (
                                <div>
                                  <p className="text-xs font-extrabold text-white">{c.name}</p>
                                  <p className="text-[9px] font-bold text-slate-400">{c.institutionName}</p>
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-slate-600 italic">Aguardando sorteio...</span>
                              )}
                            </div>
                            {c && (
                              <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-emerald-400">✓</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* RENDER BRACKETS SYSTEM (TREE STRUCTURE) */
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-12 min-w-max p-4 justify-start items-center">
                  {(() => {
                    const roundsMap = bracketMatches.reduce((acc: Record<number, any[]>, m) => {
                      if (!acc[m.round]) acc[m.round] = [];
                      acc[m.round].push(m);
                      return acc;
                    }, {});
                    const rounds = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

                    return rounds.map((round) => {
                      const roundMatches = roundsMap[round].sort((a: any, b: any) => a.match_index - b.match_index);
                      return (
                        <div key={round} className="flex flex-col gap-10 justify-around min-h-[500px] min-w-[280px]">
                          <div className="text-center mb-2">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/15">
                              {round === rounds.length ? "Final" : round === rounds.length - 1 ? "Semifinal" : `${round}ª Rodada`}
                            </span>
                          </div>
                          
                          {roundMatches.map((m: any) => {
                            const getCompName = (match: any, isTeam1: boolean) => {
                              const isRound1 = match.round === 1;
                              if (isRound1) {
                                const comp = isTeam1 ? match.renderedTeam1 : match.renderedTeam2;
                                return comp ? comp.name : null;
                              } else {
                                const roster = isTeam1 ? match.roster1 : match.roster2;
                                const team = isTeam1 ? match.team1 : match.team2;
                                return roster?.athlete_name || team?.institution?.name || null;
                              }
                            };

                            const getCompInst = (match: any, isTeam1: boolean) => {
                              const isRound1 = match.round === 1;
                              if (isRound1) {
                                const comp = isTeam1 ? match.renderedTeam1 : match.renderedTeam2;
                                return comp ? comp.institutionName : null;
                              } else {
                                const roster = isTeam1 ? match.roster1 : match.roster2;
                                const team = isTeam1 ? match.team1 : match.team2;
                                return roster?.institution_name || team?.institution?.name || null;
                              }
                            };

                            const t1Name = getCompName(m, true);
                            const t1Inst = getCompInst(m, true);
                            const t2Name = getCompName(m, false);
                            const t2Inst = getCompInst(m, false);

                            return (
                              <div 
                                key={m.id}
                                className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 w-72 shadow-xl backdrop-blur-xs relative group hover:border-indigo-500/30 transition-all duration-300"
                              >
                                <span className="absolute -top-3 left-4 text-[8px] font-black text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full border border-white/5 uppercase tracking-wider">
                                  Confronto {m.match_index + 1}
                                </span>

                                <div className="space-y-3 mt-1">
                                  {/* Team 1 / Roster 1 */}
                                  <div className={`h-11 px-3 rounded-xl border flex items-center justify-between transition-all duration-300 ${
                                    t1Name 
                                      ? 'bg-slate-800/80 border-slate-700/80 text-white' 
                                      : 'bg-white/2 border-white/5 border-dashed text-slate-600'
                                  }`}>
                                    <div className="min-w-0 flex-1">
                                      {t1Name ? (
                                        <>
                                          <p className="text-xs font-extrabold truncate">{t1Name}</p>
                                          <p className="text-[9px] font-bold text-slate-400 truncate">{t1Inst}</p>
                                        </>
                                      ) : (
                                        <span className="text-xs font-bold italic">Aguardando...</span>
                                      )}
                                    </div>
                                    {t1Name && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-wider shrink-0 ml-2">SHIRO</span>}
                                  </div>

                                  {/* VS Separator with connecting lines styling */}
                                  <div className="flex items-center justify-center relative">
                                    <div className="absolute left-0 right-0 h-px bg-white/5" />
                                    <span className="text-[9px] font-black text-slate-500 tracking-wider bg-slate-900 px-2.5 z-10">VS</span>
                                  </div>

                                  {/* Team 2 / Roster 2 */}
                                  <div className={`h-11 px-3 rounded-xl border flex items-center justify-between transition-all duration-300 ${
                                    t2Name 
                                      ? 'bg-slate-800/80 border-slate-700/80 text-white' 
                                      : 'bg-white/2 border-white/5 border-dashed text-slate-600'
                                  }`}>
                                    <div className="min-w-0 flex-1">
                                      {t2Name ? (
                                        <>
                                          <p className="text-xs font-extrabold truncate">{t2Name}</p>
                                          <p className="text-[9px] font-bold text-slate-400 truncate">{t2Inst}</p>
                                        </>
                                      ) : (
                                        <span className="text-xs font-bold italic">Aguardando...</span>
                                      )}
                                    </div>
                                    {t2Name && <span className="text-[8px] font-black text-red-400 uppercase tracking-wider shrink-0 ml-2">AO</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Large Popup Overlay: Ball Flip Reveal Stage */}
      <AnimatePresence>
        {drawStatus === 'revealing' && currentStep && (
          <motion.div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Spinning spotlights in background */}
            <div className="absolute w-[300px] h-[300px] bg-indigo-500/20 rounded-full blur-[100px] animate-pulse" />

            <motion.div
              className="w-full max-w-sm"
              initial={{ scale: 0.3, y: 100, rotate: -20 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.5, y: -100, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
            >
              {/* Outer Ball Shape that breaks/flips */}
              <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-3xl p-8 shadow-[0_0_50px_rgba(99,102,241,0.4)] relative overflow-hidden text-center">
                
                {/* Internal golden glow and particle dots */}
                <div className="absolute inset-0 bg-radial-gradient from-indigo-500/10 to-transparent pointer-events-none" />
                
                <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/25 inline-block mb-6 animate-bounce">
                  SORTEADO! ⚽
                </span>

                <h2 className="text-xl font-black text-white tracking-wide">
                  {currentStep.competitor.name}
                </h2>
                
                <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-wider">
                  {currentStep.competitor.institutionName}
                </p>

                <div className="my-6 border-t border-white/5" />

                <span className="text-xs font-semibold text-slate-500 uppercase block tracking-wider leading-none">
                  Posicionado Em:
                </span>
                <span className="text-lg font-black text-indigo-400 mt-2 block tracking-wide">
                  {currentStep.destination}
                </span>

                {/* Micro animation to mimic sliding into final slot */}
                <div className="mt-8 flex items-center justify-center">
                  <div className="w-12 h-1.5 bg-indigo-500/20 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full w-[40%] rounded-full animate-[pulse_1s_infinite]" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

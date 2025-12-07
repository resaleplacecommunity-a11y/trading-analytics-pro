import { Brain, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function DisciplinePsychology({ trades }) {
  const [commentary, setCommentary] = useState('');
  const [loading, setLoading] = useState(false);

  // Calculate discipline score (0-100%)
  const calculateDisciplineScore = () => {
    if (!trades || trades.length === 0) return 0;

    let score = 100;
    const penalties = [];

    // Rule compliance (40 points)
    const ruleCompliantTrades = trades.filter(t => t.rule_compliance).length;
    const ruleComplianceRate = ruleCompliantTrades / trades.length;
    const ruleScore = ruleComplianceRate * 40;
    score = ruleScore;
    if (ruleComplianceRate < 0.8) {
      penalties.push(`Rule compliance: ${(ruleComplianceRate * 100).toFixed(0)}%`);
    }

    // Emotional stability (30 points)
    const avgEmotion = trades.reduce((s, t) => s + (t.emotional_state || 5), 0) / trades.length;
    const emotionScore = (avgEmotion / 10) * 30;
    score += emotionScore;
    if (avgEmotion < 6) {
      penalties.push(`Low emotional state: ${avgEmotion.toFixed(1)}/10`);
    }

    // Strategy consistency (30 points)
    const strategyCounts = {};
    trades.forEach(t => {
      if (t.strategy_tag) {
        strategyCounts[t.strategy_tag] = (strategyCounts[t.strategy_tag] || 0) + 1;
      }
    });
    const hasStrategy = Object.keys(strategyCounts).length > 0;
    const consistencyScore = hasStrategy ? 30 : 15;
    score += consistencyScore;
    if (!hasStrategy) {
      penalties.push('No strategy tags used');
    }

    return Math.round(Math.min(100, Math.max(0, score)));
  };

  const disciplineScore = calculateDisciplineScore();

  // Generate AI commentary
  useEffect(() => {
    const generateCommentary = async () => {
      if (!trades || trades.length < 3) {
        setCommentary('Insufficient data for analysis. Complete at least 3 trades.');
        return;
      }

      setLoading(true);
      try {
        const recentTrades = trades.slice(0, 10);
        const avgEmotion = recentTrades.reduce((s, t) => s + (t.emotional_state || 5), 0) / recentTrades.length;
        const avgConfidence = recentTrades.reduce((s, t) => s + (t.confidence_level || 5), 0) / recentTrades.length;
        const ruleCompliance = recentTrades.filter(t => t.rule_compliance).length / recentTrades.length;
        
        const strategies = {};
        recentTrades.forEach(t => {
          if (t.strategy_tag) strategies[t.strategy_tag] = (strategies[t.strategy_tag] || 0) + 1;
        });

        const prompt = `Based on trading psychology analysis:
- Discipline Score: ${disciplineScore}/100
- Average Emotional State: ${avgEmotion.toFixed(1)}/10
- Average Confidence: ${avgConfidence.toFixed(1)}/10
- Rule Compliance Rate: ${(ruleCompliance * 100).toFixed(0)}%
- Strategies Used: ${Object.keys(strategies).join(', ') || 'None'}

Provide a concise 2-3 sentence psychological commentary focusing on trader discipline, emotional patterns, and areas for improvement. Be direct and actionable.`;

        const result = await base44.integrations.Core.InvokeLLM({ 
          prompt,
          add_context_from_internet: false
        });
        
        setCommentary(result);
      } catch (err) {
        console.error('AI commentary error:', err);
        setCommentary('Unable to generate commentary.');
      }
      setLoading(false);
    };

    generateCommentary();
  }, [trades, disciplineScore]);

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-emerald-500/20';
    if (score >= 60) return 'bg-yellow-500/20';
    return 'bg-red-500/20';
  };

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] rounded-xl p-5 border border-[#2a2a2a]">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-[#c0c0c0]" />
        <h3 className="text-[#c0c0c0] text-sm font-medium">Discipline & Psychology</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Score */}
        <div className="flex flex-col items-center justify-center bg-[#151515] rounded-lg p-6">
          <p className="text-[#666] text-xs mb-2">Discipline Score</p>
          <div className={`text-5xl font-bold ${getScoreColor(disciplineScore)} mb-2`}>
            {disciplineScore}
          </div>
          <div className={`px-3 py-1 rounded-full text-xs ${getScoreBg(disciplineScore)} ${getScoreColor(disciplineScore)}`}>
            {disciplineScore >= 80 ? 'Excellent' : disciplineScore >= 60 ? 'Good' : 'Needs Improvement'}
          </div>
        </div>

        {/* Commentary */}
        <div className="bg-[#151515] rounded-lg p-4 flex flex-col justify-center">
          <div className="flex items-start gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[#888] mt-0.5 flex-shrink-0" />
            <p className="text-[#666] text-xs">Psychology Commentary</p>
          </div>
          {loading ? (
            <p className="text-[#888] text-sm italic">Analyzing...</p>
          ) : (
            <p className="text-[#c0c0c0] text-sm leading-relaxed">{commentary}</p>
          )}
        </div>
      </div>
    </div>
  );
}
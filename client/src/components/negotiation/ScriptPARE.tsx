import { motion } from 'framer-motion';

interface ScriptPAREProps {
  script: {
    problem: string;
    agitation: string;
    resolution: string;
    emotion: string;
  };
}

export function ScriptPARE({ script }: ScriptPAREProps) {
  const phases = [
    { 
      key: 'problem', 
      icon: '❗', 
      title: 'Problema', 
      subtitle: 'Identifique a dor',
      text: script.problem, 
      color: 'red',
      borderColor: 'border-red-500/30',
      bgColor: 'bg-red-500/10',
      iconBg: 'bg-red-500/20',
    },
    { 
      key: 'agitation', 
      icon: '😰', 
      title: 'Agitação', 
      subtitle: 'Amplifique a urgência',
      text: script.agitation, 
      color: 'orange',
      borderColor: 'border-orange-500/30',
      bgColor: 'bg-orange-500/10',
      iconBg: 'bg-orange-500/20',
    },
    { 
      key: 'resolution', 
      icon: '✅', 
      title: 'Resolução', 
      subtitle: 'Apresente a solução',
      text: script.resolution, 
      color: 'green',
      borderColor: 'border-green-500/30',
      bgColor: 'bg-green-500/10',
      iconBg: 'bg-green-500/20',
    },
    { 
      key: 'emotion', 
      icon: '❤️', 
      title: 'Emoção', 
      subtitle: 'Conecte com o sonho',
      text: script.emotion, 
      color: 'purple',
      borderColor: 'border-purple-500/30',
      bgColor: 'bg-purple-500/10',
      iconBg: 'bg-purple-500/20',
    },
  ];
  
  return (
    <div className="relative space-y-4">
      {/* Linha conectora vertical */}
      <div className="absolute left-6 top-10 bottom-10 w-0.5 bg-gradient-to-b from-red-500/50 via-orange-500/50 via-green-500/50 to-purple-500/50" />
      
      {phases.map((phase, index) => (
        <motion.div
          key={phase.key}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.15, duration: 0.4 }}
          className="relative flex gap-4 items-start"
        >
          {/* Ícone */}
          <div className={`flex-shrink-0 w-12 h-12 rounded-full ${phase.iconBg} border ${phase.borderColor} flex items-center justify-center text-2xl z-10 shadow-lg`}>
            {phase.icon}
          </div>
          
          {/* Card de conteúdo */}
          <div className={`flex-1 ${phase.bgColor} rounded-lg border ${phase.borderColor} p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-gray-200">{phase.title}</h4>
              <span className="text-xs text-gray-500">• {phase.subtitle}</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{phase.text}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

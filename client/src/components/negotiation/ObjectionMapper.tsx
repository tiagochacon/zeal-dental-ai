import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, AlertTriangle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Objection {
  objection: string;
  response: string;
  context?: string;
}

interface ObjectionMapperProps {
  objections: Objection[];
}

export function ObjectionMapper({ objections }: ObjectionMapperProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  if (objections.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Nenhuma objeção detectada na consulta</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {objections.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/50"
        >
          <button
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-700/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wide">Objeção {index + 1}</span>
                <p className="font-medium text-gray-200">{item.objection}</p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                'w-5 h-5 text-gray-400 transition-transform duration-200',
                expandedIndex === index && 'rotate-180'
              )}
            />
          </button>
          
          <AnimatePresence>
            {expandedIndex === index && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-2 border-t border-gray-700">
                  {item.context && (
                    <p className="text-sm text-gray-500 mb-3 italic">
                      Contexto: {item.context}
                    </p>
                  )}
                  <div className="flex items-start gap-3 bg-green-500/10 rounded-lg p-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex-shrink-0">
                      <Lightbulb className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-xs text-green-400 uppercase tracking-wide font-medium">Resposta Sugerida</span>
                      <p className="text-gray-300 mt-1">{item.response}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}

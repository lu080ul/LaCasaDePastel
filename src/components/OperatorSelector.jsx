import React, { useState, useEffect } from 'react';
import { User, ChevronDown, Check, X } from 'lucide-react';

const OPERATOR_KEY = 'lacasa_current_operator';
const OPERATORS_LIST_KEY = 'lacasa_operators';

const defaultOperators = ['Luigi', 'Maria', 'João', 'Carlos', 'Ana'];

const OperatorSelector = () => {
  const [currentOperator, setCurrentOperator] = useState('');
  const [operators, setOperators] = useState(defaultOperators);
  const [isOpen, setIsOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(OPERATOR_KEY);
    if (saved) setCurrentOperator(saved);
    
    const savedOperators = localStorage.getItem(OPERATORS_LIST_KEY);
    if (savedOperators) {
      setOperators(JSON.parse(savedOperators));
    }
  }, []);

  const selectOperator = (name) => {
    setCurrentOperator(name);
    localStorage.setItem(OPERATOR_KEY, name);
    setIsOpen(false);
    setShowCustomInput(false);
  };

  const selectCustomOperator = () => {
    if (customName.trim()) {
      selectOperator(customName.trim());
      setCustomName('');
    }
  };

  if (!currentOperator) {
    return (
      <div className="fixed top-6 left-6 z-50">
        <div className="glass-panel p-4 rounded-2xl">
          <p className="text-white font-bold mb-3 flex items-center gap-2">
            <User className="w-5 h-5 text-lacasa-primary" />
            Identifique-se para começar
          </p>
          <div className="flex flex-wrap gap-2">
            {operators.map(name => (
              <button
                key={name}
                onClick={() => selectOperator(name)}
                className="px-4 py-2 rounded-xl bg-lacasa-bg hover:bg-lacasa-primary/20 border border-white/10 hover:border-lacasa-primary/50 text-white font-medium transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCustomInput(true)}
            className="mt-3 text-sm text-gray-400 hover:text-white transition-colors"
          >
            + Outro operador
          </button>
          {showCustomInput && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && selectCustomOperator()}
                placeholder="Nome do operador"
                className="flex-1 bg-lacasa-bg border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-lacasa-primary"
                autoFocus
              />
              <button
                onClick={selectCustomOperator}
                className="px-4 py-2 bg-lacasa-primary rounded-xl text-white font-bold hover:bg-rose-500 transition-colors"
              >
                OK
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-6 left-6 z-50">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 hover:bg-white/10 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-lacasa-primary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-lacasa-primary" />
          </div>
          <span className="text-white font-medium">{currentOperator}</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 glass-panel rounded-xl p-2 min-w-[200px] shadow-xl">
            <div className="text-xs text-gray-500 font-bold px-3 py-2 uppercase tracking-wider">
              Trocar operador
            </div>
            {operators.filter(n => n !== currentOperator).map(name => (
              <button
                key={name}
                onClick={() => selectOperator(name)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-white transition-colors flex items-center gap-2"
              >
                <User className="w-4 h-4 text-gray-400" />
                {name}
              </button>
            ))}
            <div className="border-t border-white/10 mt-2 pt-2">
              <button
                onClick={() => { setShowCustomInput(!showCustomInput); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-gray-400 transition-colors text-sm"
              >
                + Outro operador
              </button>
            </div>
          </div>
        )}

        {showCustomInput && (
          <div className="absolute top-full left-0 mt-2 glass-panel rounded-xl p-3 min-w-[240px] shadow-xl">
            <div className="flex gap-2">
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && selectCustomOperator()}
                placeholder="Nome do operador"
                className="flex-1 bg-lacasa-bg border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-lacasa-primary"
                autoFocus
              />
              <button
                onClick={selectCustomOperator}
                className="p-2 bg-lacasa-primary rounded-xl text-white hover:bg-rose-500 transition-colors"
              >
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowCustomInput(false)}
                className="p-2 bg-white/10 rounded-xl text-gray-400 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const getCurrentOperator = () => {
  return localStorage.getItem(OPERATOR_KEY) || 'Operador';
};

export default OperatorSelector;

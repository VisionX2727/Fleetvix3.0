import { Layout } from "@/components/layout";
import { useEffect, useState } from "react";
import { Delete, Calculator as CalculatorIcon } from "lucide-react";

export default function Calculator() {
  const [display, setDisplay] = useState(() => localStorage.getItem("fleet-calculator-display") || "0");
  const [equation, setEquation] = useState(() => localStorage.getItem("fleet-calculator-equation") || "");

  useEffect(() => {
    localStorage.setItem("fleet-calculator-display", display);
    localStorage.setItem("fleet-calculator-equation", equation);
  }, [display, equation]);

  const append = (val: string) => {
    if (display === '0' && val !== '.') setDisplay(val);
    else setDisplay(display + val);
  };

  const calculate = () => {
    try {
      // safe eval alternative for simple calc
      const res = new Function('return ' + display)();
      setEquation(display + ' =');
      setDisplay(String(res));
    } catch(e) {
      setDisplay('Error');
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
    localStorage.removeItem("fleet-calculator-display");
    localStorage.removeItem("fleet-calculator-equation");
  };

  const backspace = () => {
    if (display.length === 1) setDisplay('0');
    else setDisplay(display.slice(0, -1));
  };

  const buttons = [
    ['C', '⌫', '%', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '00', '.', '=']
  ];

  return (
    <Layout>
      <div className="fm-calculator-page bg-background">
        <header className="fm-calculator-header">
          <CalculatorIcon className="text-primary" size={24} />
          <h1>Calculator</h1>
        </header>
        <div className="fm-calculator-display">
          <div className="w-full text-right">
            <div className="text-right text-sm text-muted-foreground font-medium h-6">
            {equation}
            </div>
            <div className="text-6xl font-black tracking-tighter text-foreground overflow-x-auto no-scrollbar">{display}</div>
          </div>
        </div>
        <div className="fm-calculator-grid">
          {buttons.flat().map((btn, i) => {
            const isOp = ['/', '*', '-', '+', '='].includes(btn);
            const isAction = ['C', '⌫', '%'].includes(btn);
            return (
              <button
                key={i}
                onClick={() => {
                  if (btn === 'C') clear();
                  else if (btn === '⌫') backspace();
                  else if (btn === '=') calculate();
                  else append(btn);
                }}
                className={`fm-calculator-button ${isOp ? 'operator' : isAction ? 'action' : ''} ${btn === "=" ? "equals" : ""}`}
              >
                {btn === '⌫' ? <Delete size={24} /> : btn}
              </button>
            )
          })}
        </div>
      </div>
    </Layout>
  );
}

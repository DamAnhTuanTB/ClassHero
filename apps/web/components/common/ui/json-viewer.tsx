import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface JsonViewerProps {
  data: any;
  name?: string;
  depth?: number;
  collapseAtDepth?: number;
}

export function JsonViewer({ data, name, depth = 0, collapseAtDepth = 1 }: JsonViewerProps) {
  const defaultExpanded = depth < collapseAtDepth;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (typeof data !== 'object' || data === null) {
    let valueSpan = <span className="text-emerald-600 dark:text-emerald-400">{JSON.stringify(data)}</span>;
    if (typeof data === 'string') {
      valueSpan = <span className="text-amber-600 dark:text-amber-400 break-words whitespace-pre-wrap">"{data}"</span>;
    } else if (typeof data === 'number') {
      valueSpan = <span className="text-blue-600 dark:text-blue-400">{data}</span>;
    } else if (typeof data === 'boolean') {
      valueSpan = <span className="text-purple-600 dark:text-purple-400">{data ? 'true' : 'false'}</span>;
    }

    return (
      <div className="pl-4 py-0.5 font-mono text-xs flex">
        {name && <span className="text-slate-700 dark:text-slate-300 mr-2 font-semibold">"{name}":</span>}
        <div className="flex-1">{valueSpan}{name !== undefined ? ',' : ''}</div>
      </div>
    );
  }

  const isArray = Array.isArray(data);
  const keys = Object.keys(data);
  const isEmpty = keys.length === 0;

  if (isEmpty) {
    return (
      <div className="pl-4 py-0.5 font-mono text-xs">
        {name && <span className="text-slate-700 dark:text-slate-300 mr-2 font-semibold">"{name}":</span>}
        <span className="text-slate-500">{isArray ? '[]' : '{}'}</span>
      </div>
    );
  }

  return (
    <div className="font-mono text-xs">
      <div 
        className="flex items-center py-0.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -ml-1"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ paddingLeft: name ? '1rem' : '0.25rem' }}
      >
        <span className="text-slate-400 mr-1 flex-shrink-0">
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        {name && <span className="text-slate-700 dark:text-slate-300 mr-2 font-semibold">"{name}":</span>}
        <span className="text-slate-500">{isArray ? '[' : '{'}</span>
        {!isExpanded && <span className="text-slate-400 mx-1">...</span>}
        {!isExpanded && <span className="text-slate-500">{isArray ? ']' : '}'}{name !== undefined ? ',' : ''}</span>}
        {!isExpanded && <span className="text-slate-400 ml-2 text-[10px]">{keys.length} items</span>}
      </div>
      
      {isExpanded && (
        <div>
          <div className="pl-2 border-l border-slate-200 dark:border-slate-700 ml-3">
            {keys.map((key, index) => (
              <JsonViewer 
                key={key} 
                name={isArray ? undefined : key} 
                data={data[key as keyof typeof data]} 
                depth={depth + 1}
                collapseAtDepth={collapseAtDepth}
              />
            ))}
          </div>
          <div className="pl-4 py-0.5 text-slate-500">
            {isArray ? ']' : '}'}{name !== undefined ? ',' : ''}
          </div>
        </div>
      )}
    </div>
  );
}

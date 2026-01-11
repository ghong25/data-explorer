import type { FileTabState } from '../types';

interface TabBarProps {
  tabs: FileTabState[];
  activeTabId: string;
  onTabSelect: (tableName: string) => void;
  onTabClose: (tableName: string) => void;
  onAddFile: () => void;
}

export function TabBar({ tabs, activeTabId, onTabSelect, onTabClose, onAddFile }: TabBarProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 border-b overflow-x-auto">
      {tabs.map(tab => {
        const hasFilters = !!(tab.quickFilter || (tab.filterModel && Object.keys(tab.filterModel).length > 0));
        const isActive = tab.file.tableName === activeTabId;

        return (
          <button
            key={tab.file.tableName}
            onClick={() => onTabSelect(tab.file.tableName)}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-t text-sm whitespace-nowrap transition-colors
              ${isActive
                ? 'bg-white border-t border-l border-r border-gray-300 -mb-px font-medium'
                : 'bg-gray-200 hover:bg-gray-300 border border-transparent'
              }`}
          >
            <span className="truncate max-w-[150px]" title={tab.file.name}>
              {tab.file.name}
            </span>
            <span className="text-xs text-gray-500">
              ({tab.file.rowCount.toLocaleString()})
            </span>
            {hasFilters && (
              <span
                className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"
                title="Has active filters"
              />
            )}
            <span
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.file.tableName);
              }}
              className={`ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-400/30 text-gray-400 hover:text-gray-600 cursor-pointer
                ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              title="Close tab"
            >
              &times;
            </span>
          </button>
        );
      })}
      <button
        onClick={onAddFile}
        className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded flex-shrink-0"
        title="Load new file"
      >
        +
      </button>
    </div>
  );
}

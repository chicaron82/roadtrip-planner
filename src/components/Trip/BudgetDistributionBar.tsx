import type { BudgetWeights } from '../../types';

interface Props {
  weights: BudgetWeights;
  total: number;
}

export function BudgetDistributionBar({ weights, total }: Props) {
  if (total <= 0) return null;

  return (
    <div className="pt-3 border-t border-gray-200">
      <label className="text-xs text-gray-500 mb-2 block">Budget Distribution</label>
      <div className="h-4 rounded-full overflow-hidden flex bg-gray-200">
        <div
          className="bg-orange-400 transition-all"
          style={{ width: `${weights.gas}%` }}
          title={`Gas: ${weights.gas}%`}
        />
        <div
          className="bg-blue-400 transition-all"
          style={{ width: `${weights.hotel}%` }}
          title={`Hotel: ${weights.hotel}%`}
        />
        <div
          className="bg-green-400 transition-all"
          style={{ width: `${weights.food}%` }}
          title={`Food: ${weights.food}%`}
        />
        <div
          className="bg-purple-400 transition-all"
          style={{ width: `${weights.misc}%` }}
          title={`Misc: ${weights.misc}%`}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          Gas {weights.gas}%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          Hotel {weights.hotel}%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          Food {weights.food}%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          Misc {weights.misc}%
        </span>
      </div>
    </div>
  );
}

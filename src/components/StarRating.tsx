import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  onRatingChange: (rating: number) => void;
  label?: string;
  required?: boolean;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  showValue?: boolean;
}

export function StarRating({
  rating,
  maxStars = 5,
  onRatingChange,
  label,
  required = false,
  size = 'md',
  disabled = false,
  showValue = true,
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleStarClick = (starIndex: number) => {
    if (disabled) return;
    // If clicking the same star that's already selected, deselect it (set to 0)
    if (rating === starIndex) {
      onRatingChange(0);
    } else {
      onRatingChange(starIndex);
    }
  };

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {required && <span className="text-red-400 text-xs">*</span>}
          {!required && <span className="text-muted-foreground text-xs">(optional)</span>}
        </div>
      )}
      <div className="flex items-center gap-1">
        {Array.from({ length: maxStars }, (_, index) => {
          const starValue = index + 1;
          const isFilled = starValue <= rating;
          
          return (
            <button
              key={starValue}
              type="button"
              onClick={() => handleStarClick(starValue)}
              disabled={disabled}
              className={cn(
                'transition-all duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded',
                disabled && 'cursor-not-allowed opacity-50 hover:scale-100'
              )}
              aria-label={`Rate ${starValue} out of ${maxStars}`}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  'transition-colors duration-150',
                  isFilled 
                    ? 'fill-yellow-400 text-yellow-400' 
                    : 'fill-transparent text-muted-foreground hover:text-yellow-400/70'
                )}
              />
            </button>
          );
        })}
        {showValue && rating > 0 && (
          <span className="ml-2 text-sm text-muted-foreground">
            {rating}/{maxStars}
          </span>
        )}
      </div>
    </div>
  );
}

interface SafetyScoreSliderProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export function SafetyScoreSlider({
  value,
  onChange,
  label = 'Overall Safety Score',
  required = true,
  disabled = false,
}: SafetyScoreSliderProps) {
  const getScoreColor = (score: number) => {
    if (score <= 3) return 'text-red-400';
    if (score <= 5) return 'text-yellow-400';
    if (score <= 7) return 'text-blue-400';
    return 'text-green-400';
  };

  const getScoreLabel = (score: number) => {
    if (score === 0) return 'Not rated';
    if (score <= 2) return 'Very Unsafe';
    if (score <= 4) return 'Somewhat Unsafe';
    if (score <= 6) return 'Moderate';
    if (score <= 8) return 'Fairly Safe';
    return 'Very Safe';
  };

  const getScoreBgColor = (score: number) => {
    if (score <= 3) return 'bg-red-500';
    if (score <= 5) return 'bg-yellow-500';
    if (score <= 7) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {required && <span className="text-red-400 text-xs">*</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xl font-bold', getScoreColor(value))}>
            {value}/10
          </span>
          <span className={cn('text-xs px-2 py-0.5 rounded', getScoreColor(value))}>
            {getScoreLabel(value)}
          </span>
        </div>
      </div>
      
      {/* Score buttons */}
      <div className="flex gap-1">
        {Array.from({ length: 10 }, (_, i) => {
          const scoreValue = i + 1;
          const isSelected = scoreValue <= value;
          
          return (
            <button
              key={scoreValue}
              type="button"
              onClick={() => !disabled && onChange(scoreValue)}
              disabled={disabled}
              className={cn(
                'flex-1 h-8 rounded text-xs font-medium transition-all duration-150',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
                disabled && 'cursor-not-allowed opacity-50',
                isSelected 
                  ? getScoreBgColor(scoreValue) + ' text-white' 
                  : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
              )}
            >
              {scoreValue}
            </button>
          );
        })}
      </div>
      
      {/* Scale labels */}
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Unsafe</span>
        <span>Safe</span>
      </div>
    </div>
  );
}

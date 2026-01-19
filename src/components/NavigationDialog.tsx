import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Navigation, MapPin, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import type { RouteData, NavigationStep, Location } from '@/services/googleMaps';
import { googleMapsService } from '@/services/googleMaps';

interface NavigationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: RouteData | null;
}

export function NavigationDialog({ open, onOpenChange, route }: NavigationDialogProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentStep, setCurrentStep] = useState<NavigationStep | null>(null);
  const [allSteps, setAllSteps] = useState<NavigationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stopNavigation, setStopNavigation] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (route && open) {
      const steps = googleMapsService.getNavigationSteps(route);
      setAllSteps(steps);
      setCurrentStepIndex(0);
      if (steps.length > 0) {
        setCurrentStep(steps[0]);
      }
    }
  }, [route, open]);

  const handleStartNavigation = () => {
    if (!route) return;

    setIsNavigating(true);

    const stopFn = googleMapsService.startNavigation(
      route,
      (location, nextStep) => {
        setCurrentLocation(location);
        setCurrentStep(nextStep);
        
        // Update current step index
        if (nextStep) {
          const index = allSteps.findIndex(
            step => step.instruction === nextStep.instruction
          );
          if (index !== -1) {
            setCurrentStepIndex(index);
          }
        }
      }
    );

    setStopNavigation(() => stopFn);
  };

  const handleStopNavigation = () => {
    if (stopNavigation) {
      stopNavigation();
      setStopNavigation(null);
    }
    setIsNavigating(false);
    setCurrentLocation(null);
  };

  const handleClose = () => {
    handleStopNavigation();
    onOpenChange(false);
  };

  if (!route) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" />
            <DialogTitle className="text-foreground">Turn-by-Turn Navigation</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            {route.name} • {route.distance} • {route.duration}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Safety Score Badge */}
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={route.safetyScore >= 85 ? 'default' : route.safetyScore >= 70 ? 'secondary' : 'destructive'}
                    className="text-sm"
                  >
                    Safety Score: {route.safetyScore}/100
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {route.type === 'safe' ? 'Safest Route' : route.type === 'balanced' ? 'Balanced Route' : 'Fastest Route'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Location & Next Step */}
          {isNavigating && currentLocation && (
            <Card className="bg-primary/10 border-primary">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Current Location</p>
                    <p className="text-xs text-muted-foreground">{currentLocation.address}</p>
                  </div>
                </div>

                {currentStep && (
                  <div className="flex items-start gap-3 pt-3 border-t border-border">
                    <TrendingUp className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Next Step</p>
                      <p className="text-sm text-foreground mt-1">{currentStep.instruction}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {currentStep.duration}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {currentStep.distance}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {!currentStep && (
                  <div className="flex items-center gap-2 pt-3 border-t border-border text-primary">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm font-medium">You've arrived at your destination!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Navigation Controls */}
          <div className="flex gap-2">
            {!isNavigating ? (
              <Button
                onClick={handleStartNavigation}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Start Navigation
              </Button>
            ) : (
              <Button
                onClick={handleStopNavigation}
                variant="destructive"
                className="flex-1"
              >
                Stop Navigation
              </Button>
            )}
          </div>

          {/* All Steps List */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                All Directions ({allSteps.length} steps)
              </h3>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {allSteps.map((step, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 p-3 rounded-lg transition-colors ${
                        isNavigating && index === currentStepIndex
                          ? 'bg-primary/20 border border-primary'
                          : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            isNavigating && index === currentStepIndex
                              ? 'bg-primary text-primary-foreground'
                              : index < currentStepIndex && isNavigating
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          {index + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground break-words">
                          {step.instruction}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {step.distance}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {step.duration}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

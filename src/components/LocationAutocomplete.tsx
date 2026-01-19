import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { googleMapsService } from '@/services/googleMaps';

interface LocationAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onSelect: (location: { address: string; lat?: number; lng?: number }) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

interface Prediction {
    place_id: string;
    description: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
}

export function LocationAutocomplete({
    value,
    onChange,
    onSelect,
    placeholder = 'Search location...',
    className,
    disabled = false
}: LocationAutocompleteProps) {
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
    const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

    // Initialize Google Maps service
    useEffect(() => {
        const initService = async () => {
            try {
                await googleMapsService.ensureLoaded();
                if (window.google && window.google.maps && window.google.maps.places) {
                    autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
                    sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
                }
            } catch (error) {
                console.error('Failed to load Google Maps service:', error);
            }
        };
        initService();
    }, []);

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch predictions when input changes
    useEffect(() => {
        const fetchPredictions = async () => {
            if (!value || value.length < 2 || !autocompleteServiceRef.current) {
                setPredictions([]);
                setIsOpen(false);
                return;
            }

            // If the value matches the selected value exactly, don't search (avoid popup when selecting)
            // This is a rough check, can be improved

            setIsLoading(true);
            try {
                const request: google.maps.places.AutocompletionRequest = {
                    input: value,
                    sessionToken: sessionTokenRef.current || undefined,
                    // Optional: Restrict to a specific country if needed
                    // componentRestrictions: { country: 'in' }, 
                };

                autocompleteServiceRef.current.getPlacePredictions(request, (results, status) => {
                    setIsLoading(false);
                    if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                        setPredictions(results.map(result => ({
                            place_id: result.place_id,
                            description: result.description,
                            structured_formatting: {
                                main_text: result.structured_formatting.main_text,
                                secondary_text: result.structured_formatting.secondary_text
                            }
                        })));
                        setIsOpen(true);
                    } else {
                        setPredictions([]);
                        setIsOpen(false);
                    }
                });
            } catch (error) {
                console.error('Error fetching predictions:', error);
                setIsLoading(false);
                setPredictions([]);
            }
        };

        // Debounce
        const timeoutId = setTimeout(fetchPredictions, 300);
        return () => clearTimeout(timeoutId);
    }, [value]);

    const handleSelect = (prediction: Prediction) => {
        onChange(prediction.description);
        setIsOpen(false);

        // Get details including geometry
        const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
        placesService.getDetails(
            {
                placeId: prediction.place_id,
                fields: ['geometry', 'formatted_address'],
                sessionToken: sessionTokenRef.current || undefined
            },
            (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
                    onSelect({
                        address: prediction.description,
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng()
                    });

                    // Refresh session token after selection
                    sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
                } else {
                    // Fallback if details fail, just return address
                    onSelect({ address: prediction.description });
                }
            }
        );
    };

    return (
        <div ref={wrapperRef} className={cn("relative", className)}>
            <div className="relative">
                <Input
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        // Re-open if user types again
                        if (!isOpen && e.target.value.length > 1) setIsOpen(true);
                    }}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="pl-10 pr-4 h-12 bg-card/50 backdrop-blur-sm border-white/10 text-white placeholder:text-gray-400 focus:border-[#2EC4B6]/50 focus:ring-[#2EC4B6]/20 transition-all"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#2EC4B6]" />
                    ) : (
                        <Search className="h-4 w-4" />
                    )}
                </div>
            </div>

            {isOpen && predictions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-[#1a2332] border border-white/10 rounded-md shadow-xl max-h-60 overflow-y-auto overflow-x-hidden backdrop-blur-md">
                    {predictions.map((prediction) => (
                        <div
                            key={prediction.place_id}
                            onClick={() => handleSelect(prediction)}
                            className="flex items-start gap-3 p-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0"
                        >
                            <div className="mt-1 bg-white/10 p-1.5 rounded-full shrink-0">
                                <MapPin className="h-4 w-4 text-[#2EC4B6]" />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-white text-sm font-medium truncate">
                                    {prediction.structured_formatting.main_text}
                                </span>
                                <span className="text-gray-400 text-xs truncate">
                                    {prediction.structured_formatting.secondary_text}
                                </span>
                            </div>
                        </div>
                    ))}
                    <div className="flex items-center justify-end px-2 py-1 bg-black/20">
                        <span className="text-[10px] text-gray-500">powered by Google</span>
                    </div>
                </div>
            )}
        </div>
    );
}

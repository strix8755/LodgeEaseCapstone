/**
 * Initialize Google Map for lodge detail pages
 * @param {Object} options Configuration options for the map
 */
function initializeLodgeMap(options = {}) {
    const {
        elementId = 'lodge-map',
        lat = 16.4023, // Default: Baguio City
        lng = 120.5960,
        zoom = 15,
        title = 'Lodge Location',
        infoContent = null
    } = options;
    
    // Create map
    const map = new google.maps.Map(document.getElementById(elementId), {
        center: { lat, lng },
        zoom,
        styles: [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });

    // Add marker
    const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        title,
        animation: google.maps.Animation.DROP
    });

    // Add info window if content provided
    if (infoContent) {
        const infoWindow = new google.maps.InfoWindow({
            content: infoContent
        });

        marker.addListener('click', () => {
            infoWindow.open(map, marker);
        });
        
        // Auto-open info window on load
        setTimeout(() => {
            infoWindow.open(map, marker);
        }, 1000);
    }

    // Add nearby attractions
    addNearbyAttractions(map, { lat, lng });
    
    return { map, marker };
}

/**
 * Add nearby attractions to the map
 */
function addNearbyAttractions(map, centerLocation) {
    // Sample Baguio attractions
    const attractions = [
        {
            position: { lat: 16.4107, lng: 120.6001 },
            title: 'Burnham Park',
            icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
            content: '<div class="p-2"><strong>Burnham Park</strong><br>Popular recreational area</div>'
        },
        {
            position: { lat: 16.4089, lng: 120.5968 },
            title: 'Session Road',
            icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            content: '<div class="p-2"><strong>Session Road</strong><br>Main commercial street</div>'
        },
        {
            position: { lat: 16.4134, lng: 120.6217 },
            title: 'Mines View Park',
            icon: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
            content: '<div class="p-2"><strong>Mines View Park</strong><br>Scenic viewpoint</div>'
        }
    ];
    
    // Check if attraction is within 1.5km of lodge
    attractions.forEach(attraction => {
        const distance = calculateDistance(
            centerLocation.lat, centerLocation.lng,
            attraction.position.lat, attraction.position.lng
        );
        
        if (distance <= 1.5) {
            const marker = new google.maps.Marker({
                position: attraction.position,
                map,
                title: attraction.title,
                icon: attraction.icon,
                opacity: 0.8
            });
            
            const infoWindow = new google.maps.InfoWindow({
                content: attraction.content
            });
            
            marker.addListener('click', () => {
                infoWindow.open(map, marker);
            });
        }
    });
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(value) {
    return value * Math.PI / 180;
}

// Export the initializer function
export { initializeLodgeMap };

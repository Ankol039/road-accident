// Website settings. Owner: Jan Russel

export const APP_NAME = 'RoadReport'

// Where the PHP API lives.
// Normally you don't need to change anything: the API is found next to the website
//   XAMPP:    http://localhost/road-accident-system/web/  ->  http://localhost/road-accident-system/api
//   Hosting:  https://your-site.com/                      ->  https://your-site.com/api
// The pages are .php now, so open them through XAMPP (Apache runs the PHP).
// VS Code Live Server (port 5500) cannot run PHP pages; if it is used anyway, the API calls go to XAMPP below.
const XAMPP_API = 'http://localhost/road-accident-system/api'
const LIVE_SERVER_PORTS = ['5500', '5501', '5502']

export const API_BASE_URL = 'https://grouptresroadreportsystem.online/roadreport-next/api'

// Default map center: Malolos, Bulacan
export const MAP_CENTER = [14.8433, 120.8114]

export const MAX_PHOTO_MB = 10

// Bulacan cities and municipalities (suggestions for the location field)
export const BULACAN_TOWNS = [
  'Angat', 'Balagtas', 'Baliwag', 'Bocaue', 'Bulakan', 'Bustos', 'Calumpit', 'Doña Remedios Trinidad',
  'Guiguinto', 'Hagonoy', 'Malolos', 'Marilao', 'Meycauayan', 'Norzagaray', 'Obando', 'Pandi', 'Paombong',
  'Plaridel', 'Pulilan', 'San Ildefonso', 'San Jose del Monte', 'San Miguel', 'San Rafael', 'Santa Maria',
]

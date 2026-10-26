// CONFIRM: provinces plus the three federal/administered territories, since offices exist there too.
// Add or remove cities freely; the dropdown and the server validation both read this object.
export const GEO: Record<string, string[]> = {
  Punjab: ["Lahore", "Faisalabad", "Rawalpindi", "Multan", "Gujranwala", "Sialkot", "Bahawalpur", "Sargodha", "Sheikhupura", "Gujrat", "Jhelum", "Sahiwal", "Rahim Yar Khan", "Dera Ghazi Khan", "Okara", "Kasur", "Chiniot", "Wah Cantonment"],
  Sindh: ["Karachi", "Hyderabad", "Sukkur", "Larkana", "Nawabshah", "Mirpur Khas", "Jacobabad", "Thatta", "Kotri", "Khairpur"],
  "Khyber Pakhtunkhwa": ["Peshawar", "Mardan", "Abbottabad", "Mingora (Swat)", "Kohat", "Mansehra", "Dera Ismail Khan", "Nowshera", "Bannu", "Swabi", "Charsadda", "Haripur"],
  Balochistan: ["Quetta", "Gwadar", "Turbat", "Khuzdar", "Hub", "Chaman", "Sibi", "Zhob", "Dera Murad Jamali", "Loralai"],
  "Islamabad Capital Territory": ["Islamabad"],
  "Gilgit-Baltistan": ["Gilgit", "Skardu", "Chilas", "Hunza"],
  "Azad Jammu & Kashmir": ["Muzaffarabad", "Mirpur", "Kotli", "Rawalakot", "Bagh"],
};
export const PROVINCES = Object.keys(GEO);

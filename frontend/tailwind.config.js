/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],   // on scanne HTML + TS
//  theme: {
 //   extend: {},
//  },
//  plugins: [],


theme: {
    extend: {
		colors: {
        atlantisBg: "#020617",      // bg très sombre
        atlantisCyan: "#22d3ee",    // cyan néon
        atlantisTeal: "#14b8a6",    // vert/bleu
        atlantisMauve: "#a855f7",   // mauve néon
		},
		boxShadow: {
        "hud-outer": "0 0 60px rgba(34,211,238,0.45)",
        "hud-panel": "0 0 25px rgba(34,211,238,0.35)",
		},
		borderRadius: {
        "hud": "1.75rem",
		},
		animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "scan-slow": "scan-slow 9s linear infinite", // Balayage radar vertical
		"scan-x-slow": "scan-x-slow 11s linear infinite", // Balayage radar horizontal
        "blink-slow": "blink-slow 1.2s steps(2, start) infinite",
		'fade-blink': 'fadeBlink 1.2s ease-in-out infinite',
		},
		keyframes: {
        "pulse-soft": {
			"0%, 100%": { opacity: 0.55 },
			"100%": { opacity: 1 },
        },
        "scan-slow": {
			"0%": { transform: "translateY(-100%)" },
			"100%": { transform: "translateY(100%)" },
        },
		"scan-x-slow": {
			"0%": { transform: "translateX(-100%)" },
			"100%": { transform: "translateX(100%)" },
		},
		"fadeBlink":
		{
        '0%, 100%': { opacity: '1' },
        '50%': { opacity: '0.2' },
      	},
        "blink-slow": {
			"0%": { opacity: 0.2 },
			"50%": { opacity: 1 },
			"100%": { opacity: 0.2 },
        },
		},
    },
	},
	plugins: [],

}




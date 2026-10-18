// Rough per-portion estimates (as listed in the plan) used only for the
// "what you missed" estimate on the Insights screen. Not medical-grade values.

export type Macro = { kcal: number; protein: number };

export const NUTRITION: Record<string, Macro> = {
  waking_water: { kcal: 0, protein: 0 },
  waking_almonds: { kcal: 35, protein: 1.3 },
  waking_dryfruits: { kcal: 45, protein: 1 },

  bf_eggs: { kcal: 360, protein: 31 },
  bf_oats: { kcal: 190, protein: 6.5 },
  bf_milk: { kcal: 125, protein: 6.5 },
  bf_banana: { kcal: 105, protein: 1.3 },
  bf_apple: { kcal: 70, protein: 0.4 },
  bf_dryfruits: { kcal: 45, protein: 1 },

  shake_milk: { kcal: 155, protein: 8 },
  shake_banana: { kcal: 105, protein: 1.3 },
  shake_peanuts: { kcal: 115, protein: 5 },
  shake_dryfruits: { kcal: 70, protein: 1.5 },
  shake_oats: { kcal: 75, protein: 2.6 },

  lunch_roti: { kcal: 400, protein: 12 },
  lunch_chicken: { kcal: 330, protein: 62 },
  lunch_salad: { kcal: 40, protein: 1.5 },
  lunch_buttermilk: { kcal: 60, protein: 3 },
  lunch_ghee: { kcal: 45, protein: 0 },

  hyd_coconut: { kcal: 45, protein: 0.5 },
  hyd_banana: { kcal: 90, protein: 1 },

  pre_curd: { kcal: 90, protein: 5 },
  pre_banana: { kcal: 105, protein: 1.3 },
  pre_pomegranate: { kcal: 70, protein: 1.5 },
  pre_sprouts: { kcal: 15, protein: 1.5 },
  pre_honey: { kcal: 20, protein: 0 },

  workout_done: { kcal: 0, protein: 0 },

  dinner_roti: { kcal: 500, protein: 15 },
  dinner_chicken: { kcal: 330, protein: 62 },
  dinner_veg: { kcal: 80, protein: 3 },
  dinner_curd: { kcal: 60, protein: 3.5 },

  bed_milk: { kcal: 155, protein: 8 },
  bed_almonds: { kcal: 55, protein: 2 },
};

/** Per unit (1 scoop / 1 tab). */
export const SUPPLEMENT_NUTRITION: Record<string, Macro> = {
  protein: { kcal: 120, protein: 24 },
  multivitamin: { kcal: 0, protein: 0 },
  omega3: { kcal: 10, protein: 0 },
};

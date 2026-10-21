export type CarlaVehicleCategory = "Car" | "Truck" | "Van" | "Bus" | "Motorcycle" | "Bicycle";

export interface CarlaVehicleOption {
  label: string;
  blueprint: string;
  category: CarlaVehicleCategory;
  generation: 1 | 2;
}

// CARLA's official vehicle catalogue (0.9.16 documentation).
export const carlaVehicles: CarlaVehicleOption[] = [
  { label: "Audi A2", blueprint: "vehicle.audi.a2", category: "Car", generation: 1 },
  { label: "Audi E-Tron", blueprint: "vehicle.audi.etron", category: "Car", generation: 1 },
  { label: "Audi TT", blueprint: "vehicle.audi.tt", category: "Car", generation: 1 },
  { label: "BMW Gran Tourer", blueprint: "vehicle.bmw.grandtourer", category: "Car", generation: 1 },
  { label: "Chevrolet Impala", blueprint: "vehicle.chevrolet.impala", category: "Car", generation: 1 },
  { label: "Citroen C3", blueprint: "vehicle.citroen.c3", category: "Car", generation: 1 },
  { label: "Dodge Police Charger", blueprint: "vehicle.dodge.charger_police", category: "Car", generation: 1 },
  { label: "Ford Mustang", blueprint: "vehicle.ford.mustang", category: "Car", generation: 1 },
  { label: "Jeep Wrangler Rubicon", blueprint: "vehicle.jeep.wrangler_rubicon", category: "Car", generation: 1 },
  { label: "Lincoln MKZ 2017", blueprint: "vehicle.lincoln.mkz_2017", category: "Car", generation: 1 },
  { label: "Mercedes Coupe", blueprint: "vehicle.mercedes.coupe", category: "Car", generation: 1 },
  { label: "Micro Microlino", blueprint: "vehicle.micro.microlino", category: "Car", generation: 1 },
  { label: "Mini Cooper S", blueprint: "vehicle.mini.cooper_s", category: "Car", generation: 1 },
  { label: "Nissan Micra", blueprint: "vehicle.nissan.micra", category: "Car", generation: 1 },
  { label: "Nissan Patrol", blueprint: "vehicle.nissan.patrol", category: "Car", generation: 1 },
  { label: "Seat Leon", blueprint: "vehicle.seat.leon", category: "Car", generation: 1 },
  { label: "Tesla Model 3", blueprint: "vehicle.tesla.model3", category: "Car", generation: 1 },
  { label: "Toyota Prius", blueprint: "vehicle.toyota.prius", category: "Car", generation: 1 },
  { label: "Dodge Charger 2020", blueprint: "vehicle.dodge.charger_2020", category: "Car", generation: 2 },
  { label: "Dodge Police Charger 2020", blueprint: "vehicle.dodge.charger_police_2020", category: "Car", generation: 2 },
  { label: "Ford Crown taxi", blueprint: "vehicle.ford.crown", category: "Car", generation: 2 },
  { label: "Lincoln MKZ 2020", blueprint: "vehicle.lincoln.mkz_2020", category: "Car", generation: 2 },
  { label: "Mercedes Coupe 2020", blueprint: "vehicle.mercedes.coupe_2020", category: "Car", generation: 2 },
  { label: "Mini Cooper S 2021", blueprint: "vehicle.mini.cooper_s_2021", category: "Car", generation: 2 },
  { label: "Nissan Patrol 2021", blueprint: "vehicle.nissan.patrol_2021", category: "Car", generation: 2 },
  { label: "CARLA Motors CarlaCola", blueprint: "vehicle.carlamotors.carlacola", category: "Truck", generation: 1 },
  { label: "European HGV", blueprint: "vehicle.carlamotors.european_hgv", category: "Truck", generation: 2 },
  { label: "CARLA Motors Firetruck", blueprint: "vehicle.carlamotors.firetruck", category: "Truck", generation: 2 },
  { label: "Tesla Cybertruck", blueprint: "vehicle.tesla.cybertruck", category: "Truck", generation: 2 },
  { label: "Volkswagen T2", blueprint: "vehicle.volkswagen.t2", category: "Van", generation: 1 },
  { label: "Ford Ambulance", blueprint: "vehicle.ford.ambulance", category: "Van", generation: 2 },
  { label: "Mercedes Sprinter", blueprint: "vehicle.mercedes.sprinter", category: "Van", generation: 2 },
  { label: "Volkswagen T2 2021", blueprint: "vehicle.volkswagen.t2_2021", category: "Van", generation: 2 },
  { label: "Mitsubishi Fusorosa", blueprint: "vehicle.mitsubishi.fusorosa", category: "Bus", generation: 2 },
  { label: "Harley Davidson Low Rider", blueprint: "vehicle.harley-davidson.low_rider", category: "Motorcycle", generation: 1 },
  { label: "Kawasaki Ninja", blueprint: "vehicle.kawasaki.ninja", category: "Motorcycle", generation: 1 },
  { label: "Vespa ZX 125", blueprint: "vehicle.vespa.zx125", category: "Motorcycle", generation: 1 },
  { label: "Yamaha YZF", blueprint: "vehicle.yamaha.yzf", category: "Motorcycle", generation: 1 },
  { label: "BH Crossbike", blueprint: "vehicle.bh.crossbike", category: "Bicycle", generation: 1 },
  { label: "Diamondback Century", blueprint: "vehicle.diamondback.century", category: "Bicycle", generation: 1 },
  { label: "Gazelle Omafiets", blueprint: "vehicle.gazelle.omafiets", category: "Bicycle", generation: 1 },
];

export const carlaCarBlueprints = carlaVehicles.filter((vehicle) => vehicle.category === "Car").map((vehicle) => vehicle.blueprint);

export const carlaPedestrians = [
  { label: "Adult · casual", blueprint: "walker.pedestrian.0001" },
  { label: "Adult · walking", blueprint: "walker.pedestrian.0002" },
  { label: "Adult · urban", blueprint: "walker.pedestrian.0003" },
  { label: "Adult · casual 2", blueprint: "walker.pedestrian.0004" },
  { label: "Adult · casual 3", blueprint: "walker.pedestrian.0005" },
];

export const carlaObstacleOptions = [
  { label: "Street barrier", blueprint: "static.prop.streetbarrier" },
  { label: "Traffic cone", blueprint: "static.prop.trafficcone01" },
  { label: "Construction warning", blueprint: "static.prop.warningconstruction" },
  { label: "Traffic warning sign", blueprint: "static.prop.trafficwarning" },
];

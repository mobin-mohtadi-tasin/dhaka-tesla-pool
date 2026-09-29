import type { Request, Response } from 'express';
import { availabilityInput, idInput } from '../validation/requests';
import { advancePool, getActivePool, getVehicle, listDriverHistory, setAvailability } from '../services/driverService';

export async function currentVehicle(req: Request, res: Response) {
  const vehicle = await getVehicle(req.session!.userId);
  res.json({ id: vehicle.id, name: vehicle.name, licensePlate: vehicle.licensePlate, capacity: vehicle.capacity, driverStatus: vehicle.driverStatus, isActive: vehicle.isActive });
}

export async function updateAvailability(req: Request, res: Response) {
  const input = availabilityInput.parse(req.body);
  const vehicle = await setAvailability(req.session!.userId, input.driverStatus);
  res.json({ id: vehicle.id, driverStatus: vehicle.driverStatus, isActive: vehicle.isActive });
}

export async function activePool(req: Request, res: Response) {
  res.json({ pool: await getActivePool(req.session!.userId) });
}

export async function tripHistory(req: Request, res: Response) {
  res.json(await listDriverHistory(req.session!.userId));
}

export const poolAction = (action: 'arrive' | 'start' | 'complete') => async (req: Request, res: Response) => {
  res.json(await advancePool(req.session!.userId, idInput.parse(req.params.id), action));
};

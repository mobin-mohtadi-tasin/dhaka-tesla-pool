import type { Request, Response } from 'express';
import { rideInput, idInput, cancellationInput } from '../validation/requests';
import { cancelRide, createRide, getRide, listRides, quoteRideFare } from '../services/rideService';

export async function quoteRide(req: Request, res: Response) {
  const input = rideInput.parse(req.body);
  res.json(quoteRideFare(input.pickupZone, input.dropoffZone, input.seatsRequested));
}

export async function requestRide(req: Request, res: Response) {
  const input = rideInput.parse(req.body);
  const result = await createRide(req.session!.userId, input.pickupZone, input.dropoffZone, input.seatsRequested);
  res.status(201).json(result);
}

export async function rideDetails(req: Request, res: Response) {
  res.json(await getRide(req.session!.userId, idInput.parse(req.params.id)));
}

export async function cancelRequestedRide(req: Request, res: Response) {
  const reason = cancellationInput.parse(req.body ?? {}).reason;
  res.json(await cancelRide(req.session!.userId, idInput.parse(req.params.id), reason));
}

export async function rideHistory(req: Request, res: Response) {
  res.json(await listRides(req.session!.userId));
}

import type { FastifyRequest, FastifyReply } from "fastify";
import { TripStopTimesService } from "./tripStopTimes.service";
import { IStorage } from "../../storage.interface";
import { insertTripStopTimeSchema, bulkUpsertTripStopTimeSchema } from "@shared/schema";
import { z } from "zod";

export class TripStopTimesController {
  private tripStopTimesService: TripStopTimesService;

  constructor(storage: IStorage) {
    this.tripStopTimesService = new TripStopTimesService(storage);
  }

  private async validateStopTimesForPayload(payload: any[], tripId: string): Promise<{ valid: boolean; errors: Array<{ stopSequence: number; field: string; message: string }> }> {
    const errors: Array<{ stopSequence: number; field: string; message: string }> = [];

    if (payload.length < 2) {
      errors.push({ stopSequence: 0, field: 'general', message: 'Trip must have at least 2 stops' });
      return { valid: false, errors };
    }

    // Sort by sequence for validation
    const sortedStopTimes = payload.sort((a, b) => a.stopSequence - b.stopSequence);
    
    for (let i = 0; i < sortedStopTimes.length; i++) {
      const stopTime = sortedStopTimes[i];
      const sequence = stopTime.stopSequence;
      const isFirst = i === 0;
      const isLast = i === sortedStopTimes.length - 1;
      
      // First stop: departure time required
      if (isFirst) {
        if (!stopTime.departAt) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'departAt', 
            message: 'First stop must have departure time' 
          });
        }
      }
      
      // Last stop: arrival time required
      if (isLast) {
        if (!stopTime.arriveAt) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'arriveAt', 
            message: 'Last stop must have arrival time' 
          });
        }
      }
      
      // Middle stops: if either time is provided, both must be provided
      if (!isFirst && !isLast) {
        const hasArrival = stopTime.arriveAt !== null;
        const hasDeparture = stopTime.departAt !== null;
        
        if (hasArrival && !hasDeparture) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'departAt', 
            message: 'Departure time required when arrival time is set' 
          });
        }
        
        if (hasDeparture && !hasArrival) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'arriveAt', 
            message: 'Arrival time required when departure time is set' 
          });
        }
      }
      
      // Validate departure >= arrival at same stop
      // Both times are stored as UTC in database, so direct comparison is valid
      if (stopTime.arriveAt && stopTime.departAt) {
        if (new Date(stopTime.departAt) < new Date(stopTime.arriveAt)) {
          errors.push({ 
            stopSequence: sequence, 
            field: 'departAt', 
            message: 'Departure time must be after arrival time' 
          });
        }
      }
      
      // Validate chronological order with previous stop
      // Both times are stored as UTC in database, so direct comparison is valid
      if (i > 0) {
        const prevStopTime = sortedStopTimes[i - 1];
        const prevDepartTime = prevStopTime.departAt;
        const currentArriveTime = stopTime.arriveAt;
        
        if (prevDepartTime && currentArriveTime) {
          if (new Date(currentArriveTime) < new Date(prevDepartTime)) {
            errors.push({ 
              stopSequence: sequence, 
              field: 'arriveAt', 
              message: 'Arrival time must be after previous stop departure time' 
            });
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async getByTrip(req: FastifyRequest, reply: FastifyReply) {
    const { tripId } = req.params;
    const stopTimes = await this.tripStopTimesService.getTripStopTimes(tripId);
    reply.send(stopTimes);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validatedData = insertTripStopTimeSchema.parse(req.body);
    const stopTime = await this.tripStopTimesService.createTripStopTime(validatedData);
    reply.code(201).send(stopTime);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    const validatedData = insertTripStopTimeSchema.partial().parse(req.body);
    const stopTime = await this.tripStopTimesService.updateTripStopTime(id, validatedData);
    reply.send(stopTime);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params;
    await this.tripStopTimesService.deleteTripStopTime(id);
    reply.code(204).send();
  }

  async getByTripWithEffectiveFlags(req: FastifyRequest, reply: FastifyReply) {
    const { tripId } = req.params;
    const stopTimes = await this.tripStopTimesService.getTripStopTimesWithEffectiveFlags(tripId);
    reply.send(stopTimes);
  }

  async bulkUpsert(req: FastifyRequest, reply: FastifyReply) {
    const { tripId } = req.params;
    const { precompute } = req.query;
    
    // Validate request body
    const validatedData = z.array(bulkUpsertTripStopTimeSchema).parse(req.body);
    
    // Check if trip has bookings - if so, only allow time edits, not reordering
    const hasBookings = await this.tripStopTimesService.storage.tripHasBookings(tripId);
    if (hasBookings) {
      // Verify that stop sequences are not being changed
      const existingStopTimes = await this.tripStopTimesService.getTripStopTimes(tripId);
      const existingSequences = existingStopTimes
        .sort((a, b) => a.stopSequence - b.stopSequence)
        .map(st => ({ stopId: st.stopId, stopSequence: st.stopSequence }));
      
      const newSequences = validatedData
        .sort((a, b) => a.stopSequence - b.stopSequence)
        .map(st => ({ stopId: st.stopId, stopSequence: st.stopSequence }));
      
      // Check if sequences match
      const sequencesMatch = existingSequences.length === newSequences.length &&
        existingSequences.every((existing, index) => 
          existing.stopId === newSequences[index].stopId && 
          existing.stopSequence === newSequences[index].stopSequence
        );
      
      if (!sequencesMatch) {
        return reply.code(400).send({
          error: 'Cannot reorder stops when trip has bookings. Only time edits are allowed.',
          code: 'trip-has-bookings'
        });
      }
    }
    
    // Validate the payload before persisting to maintain atomicity
    const tempValidation = await this.validateStopTimesForPayload(validatedData, tripId);
    
    if (!tempValidation.valid) {
      return reply.code(400).send({
        error: 'Invalid stop times',
        code: 'invalid-stop-times',
        errors: tempValidation.errors
      });
    }
    
    // If validation passes, perform the upsert
    await this.tripStopTimesService.bulkUpsertTripStopTimes(tripId, validatedData);
    
    // If validation passes, auto-derive legs
    try {
      await this.tripStopTimesService.deriveLegs(tripId);
    } catch (error) {
      return reply.code(400).send({
        error: 'Failed to derive legs from stop times',
        code: 'derive-legs-failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // If precompute=true, also precompute seat inventory
    if (precompute === 'true') {
      try {
        await this.tripStopTimesService.precomputeSeatInventory(tripId);
      } catch (error) {
        return reply.code(400).send({
          error: 'Failed to precompute seat inventory',
          code: 'precompute-inventory-failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    reply.send({ 
      success: true, 
      message: 'Trip stop times updated successfully',
      derivedLegs: true,
      precomputedInventory: precompute === 'true'
    });
  }

  async syncFromPattern(req: FastifyRequest, reply: FastifyReply) {
    const { tripId } = req.params;
    try {
      const result = await this.tripStopTimesService.syncFromPattern(tripId);
      reply.send(result);
    } catch (error) {
      reply.code(400).send({
        error: error instanceof Error ? error.message : 'Gagal sync halte dari pola rute',
      });
    }
  }

  async deriveLegs(req: FastifyRequest, reply: FastifyReply) {
    const { tripId } = req.params;
    
    // Validate stop times before deriving legs
    const validation = await this.tripStopTimesService.validateStopTimes(tripId);
    
    if (!validation.valid) {
      return reply.code(400).send({
        error: 'Cannot derive legs from invalid stop times',
        code: 'invalid-stop-times',
        errors: validation.errors
      });
    }
    
    try {
      await this.tripStopTimesService.deriveLegs(tripId);
      reply.send({ success: true, message: 'Trip legs derived successfully' });
    } catch (error) {
      reply.code(400).send({
        error: 'Failed to derive legs',
        code: 'derive-legs-failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async precomputeSeatInventory(req: FastifyRequest, reply: FastifyReply) {
    const { tripId } = req.params;
    await this.tripStopTimesService.precomputeSeatInventory(tripId);
    reply.send({ success: true, message: 'Seat inventory precomputed successfully' });
  }
}

export type RequestTicket = { controller: AbortController };

/** One owner for asynchronous work. Invalidated replies cannot update a new view. */
export class RequestLifecycle {
  private active: RequestTicket | null = null;
  private busy = false;

  get pending(): boolean { return this.busy; }

  begin(): RequestTicket {
    this.cancel();
    const ticket = { controller: new AbortController() };
    this.active = ticket;
    this.busy = true;
    return ticket;
  }

  owns(ticket: RequestTicket): boolean { return this.active === ticket; }
  canApply(ticket: RequestTicket): boolean {
    return this.owns(ticket) && !ticket.controller.signal.aborted;
  }

  // Stop retains ownership so the UI can label the partial response cancelled.
  stop(): void { this.active?.controller.abort(); }

  cancel(): void {
    const previous = this.active;
    this.active = null;
    this.busy = false;
    previous?.controller.abort();
  }

  finish(ticket: RequestTicket): void {
    // React may apply an already queued final update after this finally block.
    // Keep its ownership until the next begin/cancel, while releasing the busy flag.
    if (this.owns(ticket)) this.busy = false;
  }
}

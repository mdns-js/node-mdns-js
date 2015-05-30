Notes
=====



Regarding what ports to use
---------------------------

From RFC 6762 - Section 5.2
> A compliant Multicast DNS querier, which implements the rules
> specified in this document, MUST send its Multicast DNS queries from
> UDP source port 5353 (the well-known port assigned to mDNS), and MUST
> listen for Multicast DNS replies sent to UDP destination port 5353 at
> the mDNS link-local multicast address (224.0.0.251 and/or its IPv6
> equivalent FF02::FB).

So, if there is an already running service on that computer bound to the same port there might be issues unless there is a way of sharing 
a port. 
Needs some investigation.
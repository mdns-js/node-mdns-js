Notes
=====



## Regarding what ports to use

From [RFC 6762 - Section 5.2](https://tools.ietf.org/html/rfc6762#section-5.2)
> A compliant Multicast DNS querier, which implements the rules
> specified in this document, MUST send its Multicast DNS queries from
> UDP source port 5353 (the well-known port assigned to mDNS), and MUST
> listen for Multicast DNS replies sent to UDP destination port 5353 at
> the mDNS link-local multicast address (224.0.0.251 and/or its IPv6
> equivalent FF02::FB).

So, if there is an already running service on that computer bound to the same port there might be issues unless there is a way of sharing 
a port. 

[RFC 6762 - Section 15 - Considerations for multiple responders on the same machine](https://tools.ietf.org/html/rfc6762#section-15)
> all Multicast DNS implementations SHOULD use the
> SO_REUSEPORT and/or SO_REUSEADDR options (or equivalent as
> appropriate for the operating system in question)

But there might still be some issues as noted in section 15.4
https://tools.ietf.org/html/rfc6762#section-15.4
